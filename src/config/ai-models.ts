import type { ModelPreset } from "@/lib/ai/types";

/**
 * LISTA MODELI AI DOSTĘPNYCH W PANELU ADMINA
 *
 * Zmiana modelu w sklepie = wybór innego presetu w /admin (bez redeployu).
 * Dodanie nowego modelu = dopisanie obiektu poniżej. Kod sklepu się nie zmienia.
 *
 * Przez OpenRouter możesz użyć dowolnego modelu obrazowego, który przyjmuje zdjęcie
 * na wejściu. Aktualną listę i nazwy (slugi) znajdziesz na:
 *   https://openrouter.ai/models?output_modalities=image
 *   GET https://openrouter.ai/api/v1/images/models  (pole input_modalities musi zawierać "image")
 *
 * Opcje adaptera OpenRouter:
 *   endpoint: "chat"   -> /api/v1/chat/completions (modele Gemini, zwracają tekst + obraz)
 *   endpoint: "images" -> /api/v1/images (modele czysto obrazowe: FLUX, Seedream, GPT Image)
 *   Jeśli wybrany endpoint odrzuci model, adapter sam spróbuje drugiego.
 */
export const MODEL_PRESETS: ModelPreset[] = [
  {
    id: "nano-banana-2.1-openrouter",
    label: "Nano Banana 2.1 – przez OpenRouter",
    provider: "openrouter",
    model: "google/gemini-nano-banana-2.1",
    resolution: "2K",
    supportsBatch: false,
    estCostUsdPerImage: 0.05,
    options: { endpoint: "chat" },
    note: "Domyślny. Jeden klucz OpenRouter, łatwa zmiana na inne modele.",
  },
  {
    id: "nano-banana-2.1-google",
    label: "Nano Banana 2.1 – bezpośrednio przez Google Gemini API",
    provider: "gemini",
    model: "gemini-nano-banana-2.1",
    resolution: "2K",
    supportsBatch: false,
    estCostUsdPerImage: 0.05,
    options: { thinkingLevel: "medium" },
    note: "Bez pośrednika. Wymaga klucza z Google AI Studio z włączonym rozliczaniem.",
  },
  {
    id: "nano-banana-pro-google",
    label: "Nano Banana Pro – Google Gemini API",
    provider: "gemini",
    model: "gemini-3-pro-image",
    resolution: "2K",
    supportsBatch: false,
    note: "Droższy model Google do najbardziej wymagających zleceń.",
  },
  {
    id: "flux2-pro-openrouter",
    label: "FLUX.2 Pro (Black Forest Labs) – przez OpenRouter",
    provider: "openrouter",
    model: "black-forest-labs/flux.2-pro",
    resolution: "2K",
    supportsBatch: false,
    options: { endpoint: "images" },
    note: "Alternatywa spoza Google. Sprawdź slug na openrouter.ai przed użyciem.",
  },
  {
    id: "gpt-image-2-openrouter",
    label: "GPT Image 2 (OpenAI) – przez OpenRouter",
    provider: "openrouter",
    model: "openai/gpt-image-2",
    resolution: "2K",
    supportsBatch: true,
    options: { endpoint: "images" },
    note: "Obsługuje 4 obrazy w jednym wywołaniu. Sprawdź slug na openrouter.ai.",
  },
  {
    id: "openrouter-custom",
    label: "Dowolny model z OpenRouter (wpisz slug w panelu)",
    provider: "openrouter",
    model: "", // uzupełniany z ustawień w panelu admina
    resolution: "2K",
    supportsBatch: false,
    options: { endpoint: "images" },
    note: "Wpisz nazwę modelu, np. bytedance-seed/seedream-4.5.",
  },
  {
    id: "mock",
    label: "Tryb testowy – bez AI, za darmo",
    provider: "mock",
    model: "mock",
    resolution: "1K",
    supportsBatch: true,
    estCostUsdPerImage: 0,
    note: "Przerabia zdjęcie filtrami. Do testowania sklepu bez kluczy API.",
  },
];

export const CUSTOM_OPENROUTER_PRESET_ID = "openrouter-custom";

export function findPreset(id: string | null | undefined): ModelPreset | undefined {
  return MODEL_PRESETS.find((p) => p.id === id);
}
