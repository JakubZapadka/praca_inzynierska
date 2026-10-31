import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const SETTING_KEYS = {
  activeModelPreset: "ai.activeModelPreset",
  customOpenRouterModel: "ai.customOpenRouterModel",
} as const;

export async function getSetting(key: string): Promise<string | null> {
  const row = await db.query.settings.findFirst({ where: eq(schema.settings.key, key) });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value } });
}
