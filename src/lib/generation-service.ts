import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { buildPrompt, getStyle } from "@/config/prompts";
import { ORIENTATIONS, type Orientation } from "@/config/products";
import { SITE } from "@/config/site";
import { getActivePreset, getProvider } from "@/lib/ai";
import type { GeneratedImage, ModelPreset } from "@/lib/ai/types";
import { withTimeout } from "@/lib/ai/utils";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { makePreview, normalizeUpload } from "@/lib/images";
import { storage } from "@/lib/storage";

export const VARIANT_COUNT = SITE.variantCount;

export class LimitError extends Error {}

export function hashIp(ip: string) {
  return createHash("sha256").update(`${ip}:${env.appSecret}`).digest("hex").slice(0, 32);
}

/** Krok 1 (szybki, w trakcie zapytania): zapisuje zdjęcie i tworzy puste warianty (VARIANT_COUNT). */
export async function createGeneration(input: {
  photo: Buffer;
  prompt: string;
  styleId: string;
  orientation: Orientation;
  ip: string;
}) {
  const ipHash = hashIp(input.ip);
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.generations)
    .where(and(eq(schema.generations.ipHash, ipHash), gt(schema.generations.createdAt, hourAgo)));
  if (count >= env.generationsPerHourPerIp) {
    throw new LimitError(
      `Limit to ${env.generationsPerHourPerIp} generowań na godzinę. Wybierz jeden z gotowych obrazów albo wróć za chwilę.`,
    );
  }

  const photo = await normalizeUpload(input.photo);
  const preset = await getActivePreset();
  const id = randomUUID();
  const sourceKey = `uploads/${id}.jpg`;
  await storage.put(sourceKey, photo.data);

  await db.insert(schema.generations).values({
    id,
    status: "running",
    prompt: input.prompt,
    styleId: getStyle(input.styleId).id,
    aspectRatio: ORIENTATIONS[input.orientation].aspect,
    sourceKey,
    modelPresetId: preset.id,
    modelName: preset.model,
    ipHash,
    ip: input.ip,
  });
  await db.insert(schema.variants).values(
    Array.from({ length: VARIANT_COUNT }, (_, position) => ({
      id: randomUUID(),
      generationId: id,
      position,
      status: "pending" as const,
    })),
  );
  return { id, preset };
}

/**
 * Krok 2 (w tle, po wysłaniu odpowiedzi): wywołuje model AI.
 * Każdy wariant zapisuje się osobno, więc klient widzi obrazy w miarę ich powstawania.
 */
export async function runGeneration(id: string, preset: ModelPreset) {
  const generation = await db.query.generations.findFirst({ where: eq(schema.generations.id, id) });
  if (!generation) return;
  const variantRows = await db.query.variants.findMany({
    where: eq(schema.variants.generationId, id),
    orderBy: asc(schema.variants.position),
  });

  const provider = getProvider(preset.provider);
  const reference = { data: await storage.get(generation.sourceKey), mimeType: "image/jpeg" };
  const aspectRatio = generation.aspectRatio as (typeof ORIENTATIONS)[Orientation]["aspect"];
  const request = (variantIndex: number | null, count: number, signal: AbortSignal) => ({
    prompt: buildPrompt({ userPrompt: generation.prompt, styleId: generation.styleId, variantIndex }),
    referenceImages: [reference],
    aspectRatio,
    resolution: preset.resolution,
    count,
    signal,
  });

  let totalCost = 0;
  const saveVariant = async (variant: schema.Variant, image: GeneratedImage) => {
    const ext = image.mimeType.includes("jpeg") ? "jpg" : image.mimeType.includes("webp") ? "webp" : "png";
    const imageKey = `originals/${id}/${variant.position}.${ext}`;
    const previewKey = `previews/${id}/${variant.position}.webp`;
    const preview = await makePreview(image.data);
    await storage.put(imageKey, image.data);
    await storage.put(previewKey, preview.data);
    totalCost += image.costUsd ?? preset.estCostUsdPerImage ?? 0;
    await db
      .update(schema.variants)
      .set({ status: "done", imageKey, previewKey, width: preview.width, height: preview.height })
      .where(eq(schema.variants.id, variant.id));
  };
  const failVariant = async (variant: schema.Variant, error: unknown) => {
    console.error(`[generacja ${id}] wariant ${variant.position}:`, error);
    await db
      .update(schema.variants)
      .set({ status: "failed", error: readableError(error) })
      .where(eq(schema.variants.id, variant.id));
  };

  if (preset.supportsBatch) {
    // Jedno wywołanie zwraca wszystkie warianty naraz.
    try {
      const images = await withTimeout(env.generationTimeoutMs, (signal) =>
        provider.generate(request(null, variantRows.length, signal), preset),
      );
      await Promise.all(
        variantRows.map((v, i) =>
          images[i] ? saveVariant(v, images[i]) : failVariant(v, new Error("Model zwrócił mniej obrazów.")),
        ),
      );
    } catch (error) {
      await Promise.all(variantRows.map((v) => failVariant(v, error)));
    }
  } else {
    // Równoległe wywołania (po jednym na wariant), każde z inną wskazówką.
    await Promise.all(
      variantRows.map(async (v) => {
        try {
          const [image] = await withTimeout(env.generationTimeoutMs, (signal) =>
            provider.generate(request(v.position, 1, signal), preset),
          );
          await saveVariant(v, image);
        } catch (error) {
          await failVariant(v, error);
        }
      }),
    );
  }

  const after = await db.query.variants.findMany({ where: eq(schema.variants.generationId, id) });
  const anyDone = after.some((v) => v.status === "done");
  await db
    .update(schema.generations)
    .set({
      status: anyDone ? "done" : "failed",
      costUsd: totalCost,
      error: anyDone ? null : (after[0]?.error ?? "Nie udało się wygenerować obrazów."),
    })
    .where(eq(schema.generations.id, id));
}

export async function getGenerationView(id: string) {
  const generation = await db.query.generations.findFirst({ where: eq(schema.generations.id, id) });
  if (!generation) return null;
  const variantRows = await db.query.variants.findMany({
    where: eq(schema.variants.generationId, id),
    orderBy: asc(schema.variants.position),
  });
  return {
    id: generation.id,
    status: generation.status,
    aspectRatio: generation.aspectRatio,
    createdAt: generation.createdAt.getTime(),
    error: generation.status === "failed" ? publicError(generation.error) : null,
    variants: variantRows.map((v) => ({
      id: v.id,
      position: v.position,
      status: v.status,
      previewUrl: v.previewKey ? storage.url(v.previewKey) : null,
      width: v.width,
      height: v.height,
    })),
  };
}

function readableError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500);
  return String(error).slice(0, 500);
}

/** Klient nie powinien widzieć szczegółów technicznych (klucze, nazwy dostawców). */
function publicError(error: string | null): string {
  if (!error) return "Nie udało się wygenerować obrazów. Spróbuj ponownie.";
  if (/blokad|safety|policy|blocked|prohibited/i.test(error)) {
    return "Model odrzucił to zdjęcie lub opis. Zmień opis albo wybierz inne zdjęcie.";
  }
  if (/limit czasu|timeout|aborted/i.test(error)) {
    return "Generowanie trwało zbyt długo. Spróbuj ponownie za chwilę.";
  }
  return "Nie udało się wygenerować obrazów. Spróbuj ponownie za chwilę.";
}

/** Statystyki i ostatnie generowania do panelu admina. */
export async function getGenerationStats(days = 30, recentLimit = 12) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const [{ count, cost }] = await db
    .select({
      count: sql<number>`count(*)`,
      cost: sql<number>`coalesce(sum(${schema.generations.costUsd}), 0)`,
    })
    .from(schema.generations)
    .where(gt(schema.generations.createdAt, since));
  const recent = await db.query.generations.findMany({
    orderBy: desc(schema.generations.createdAt),
    limit: recentLimit,
  });
  const variantRows = recent.length
    ? await db.query.variants.findMany({
        where: inArray(
          schema.variants.generationId,
          recent.map((g) => g.id),
        ),
        orderBy: asc(schema.variants.position),
      })
    : [];
  return {
    count,
    cost,
    recent: recent.map((g) => ({ ...g, variants: variantRows.filter((v) => v.generationId === g.id) })),
  };
}
