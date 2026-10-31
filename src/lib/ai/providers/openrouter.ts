import { env } from "@/lib/env";
import { SITE } from "@/config/site";
import {
  ProviderError,
  type GeneratedImage,
  type ImageGenerationRequest,
  type ImageProvider,
  type ModelPreset,
} from "../types";
import { dataUrlToImage, toDataUrl } from "../utils";

/**
 * Adapter OpenRouter – jeden klucz API, setki modeli.
 * Zmiana modelu = zmiana pola `model` w presecie (np. "google/gemini-nano-banana-2.1").
 *
 * Dokumentacja:
 *  - https://openrouter.ai/docs/guides/overview/multimodal/image-generation
 */

const BASE_URL = "https://openrouter.ai/api/v1";
type Endpoint = "chat" | "images";

export class OpenRouterProvider implements ImageProvider {
  readonly id = "openrouter" as const;

  isConfigured() {
    return Boolean(env.openRouterApiKey);
  }

  async generate(req: ImageGenerationRequest, preset: ModelPreset): Promise<GeneratedImage[]> {
    if (!this.isConfigured()) {
      throw new ProviderError("Brak OPENROUTER_API_KEY w .env", this.id);
    }
    if (!preset.model) {
      throw new ProviderError("Nie wpisano nazwy modelu OpenRouter w panelu admina.", this.id);
    }

    const preferred: Endpoint = preset.options?.endpoint === "images" ? "images" : "chat";
    const fallback: Endpoint = preferred === "chat" ? "images" : "chat";

    try {
      return await this.call(preferred, req, preset);
    } catch (error) {
      // Gdy model nie obsługuje danego endpointu (400/404), spróbuj drugiego.
      if (error instanceof ProviderError && (error.status === 400 || error.status === 404)) {
        console.warn(`[openrouter] ${preferred} odrzucił model ${preset.model}, próbuję ${fallback}`);
        try {
          return await this.call(fallback, req, preset);
        } catch {
          throw error; // pokaż pierwotny błąd – zwykle bardziej czytelny
        }
      }
      throw error;
    }
  }

  private call(endpoint: Endpoint, req: ImageGenerationRequest, preset: ModelPreset) {
    return endpoint === "chat" ? this.viaChat(req, preset) : this.viaImages(req, preset);
  }

  private headers() {
    return {
      Authorization: `Bearer ${env.openRouterApiKey}`,
      "Content-Type": "application/json",
      // Opcjonalne nagłówki – pokazują Twój sklep w statystykach OpenRouter.
      "HTTP-Referer": env.siteUrl,
      "X-Title": SITE.name,
    };
  }

  /** /api/v1/images – dedykowane API obrazów (FLUX, Seedream, GPT Image…). */
  private async viaImages(req: ImageGenerationRequest, preset: ModelPreset) {
    const body: Record<string, unknown> = {
      model: preset.model,
      prompt: req.prompt,
      aspect_ratio: req.aspectRatio,
      resolution: req.resolution,
      input_references: req.referenceImages.map((img) => ({
        type: "image_url",
        image_url: { url: toDataUrl(img) },
      })),
    };
    // Modele zwracające jeden obraz odrzucają n > 1, więc wysyłamy n tylko gdy trzeba.
    if (req.count > 1) body.n = req.count;

    const json = await this.post("/images", body, req.signal);
    const data = (json.data ?? []) as Array<{ b64_json?: string; url?: string; media_type?: string }>;
    const cost = typeof json.usage?.cost === "number" ? json.usage.cost / Math.max(data.length, 1) : undefined;

    const images: GeneratedImage[] = [];
    for (const item of data) {
      if (item.b64_json) {
        images.push({
          data: Buffer.from(item.b64_json, "base64"),
          mimeType: item.media_type ?? "image/png",
          costUsd: cost,
        });
      } else if (item.url?.startsWith("data:")) {
        images.push({ ...dataUrlToImage(item.url), costUsd: cost });
      }
    }
    if (images.length === 0) {
      throw new ProviderError("Model nie zwrócił obrazu.", this.id);
    }
    return images;
  }

  /** /api/v1/chat/completions z modalities – sposób zalecany dla modeli Gemini. */
  private async viaChat(req: ImageGenerationRequest, preset: ModelPreset) {
    const body = {
      model: preset.model,
      modalities: ["image", "text"],
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: req.prompt },
            ...req.referenceImages.map((img) => ({
              type: "image_url",
              image_url: { url: toDataUrl(img) },
            })),
          ],
        },
      ],
      image_config: {
        aspect_ratio: req.aspectRatio,
        image_size: req.resolution,
      },
    };

    // Chat zwraca jeden obraz na wywołanie – dla count > 1 robimy kilka wywołań.
    const runs = await Promise.all(
      Array.from({ length: req.count }, async () => {
        const json = await this.post("/chat/completions", body, req.signal);
        const message = json.choices?.[0]?.message;
        const images = (message?.images ?? []) as Array<{ image_url?: { url?: string } }>;
        const url = images.at(-1)?.image_url?.url;
        if (!url) {
          const text = typeof message?.content === "string" ? message.content.slice(0, 300) : "";
          throw new ProviderError(
            `Model nie zwrócił obrazu${text ? `: ${text}` : " (możliwa blokada treści)"}.`,
            this.id,
          );
        }
        const cost = typeof json.usage?.cost === "number" ? json.usage.cost : undefined;
        return { ...(await resolveImageUrl(url, req.signal)), costUsd: cost };
      }),
    );
    return runs;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async post(path: string, body: unknown, signal?: AbortSignal): Promise<any> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      signal,
    });
    const text = await res.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new ProviderError(`Nieczytelna odpowiedź OpenRouter (${res.status}).`, this.id, res.status);
    }
    if (!res.ok || json.error) {
      const message = json.error?.message ?? `HTTP ${res.status}`;
      const status = typeof json.error?.code === "number" ? json.error.code : res.status;
      throw new ProviderError(`OpenRouter: ${message}`, this.id, status);
    }
    return json;
  }
}

async function resolveImageUrl(url: string, signal?: AbortSignal) {
  if (url.startsWith("data:")) return dataUrlToImage(url);
  const res = await fetch(url, { signal });
  if (!res.ok) throw new ProviderError(`Nie udało się pobrać obrazu (${res.status}).`, "openrouter");
  return {
    data: Buffer.from(await res.arrayBuffer()),
    mimeType: res.headers.get("content-type") ?? "image/png",
  };
}
