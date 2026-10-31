import { CUSTOM_OPENROUTER_PRESET_ID, MODEL_PRESETS, findPreset } from "@/config/ai-models";
import { env } from "@/lib/env";
import { SETTING_KEYS, getSetting } from "@/lib/settings";
import { GeminiProvider } from "./providers/gemini";
import { MockProvider } from "./providers/mock";
import { OpenRouterProvider } from "./providers/openrouter";
import type { ImageProvider, ModelPreset, ProviderId } from "./types";

/**
 * REJESTR ADAPTERÓW
 * Nowy dostawca (np. Replicate, fal.ai, OpenAI bezpośrednio):
 *   1. utwórz src/lib/ai/providers/<nazwa>.ts implementujący ImageProvider,
 *   2. dopisz go tutaj i do typu ProviderId w types.ts,
 *   3. dodaj preset w src/config/ai-models.ts.
 */
const PROVIDERS: Record<ProviderId, ImageProvider> = {
  openrouter: new OpenRouterProvider(),
  gemini: new GeminiProvider(),
  mock: new MockProvider(),
};

export function getProvider(id: ProviderId): ImageProvider {
  const provider = PROVIDERS[id];
  if (!provider) throw new Error(`Nieznany dostawca AI: ${id}`);
  return provider;
}

/** Aktywny model: wybór z panelu admina, a jeśli go nie ma – AI_MODEL_PRESET z .env. */
export async function getActivePreset(): Promise<ModelPreset> {
  const chosenId = (await getSetting(SETTING_KEYS.activeModelPreset)) ?? env.defaultModelPreset;
  const preset = findPreset(chosenId) ?? findPreset(env.defaultModelPreset) ?? MODEL_PRESETS[0];

  if (preset.id === CUSTOM_OPENROUTER_PRESET_ID) {
    const model = (await getSetting(SETTING_KEYS.customOpenRouterModel)) ?? "";
    return { ...preset, model, label: model ? `${model} (OpenRouter)` : preset.label };
  }
  return preset;
}

export function providerStatus() {
  return (Object.keys(PROVIDERS) as ProviderId[]).map((id) => ({
    id,
    configured: PROVIDERS[id].isConfigured(),
  }));
}

export type { ModelPreset, ImageProvider } from "./types";
