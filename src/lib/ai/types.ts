/**
 * Wspólny interfejs dla WSZYSTKICH dostawców AI.
 *
 * Reszta sklepu (generowanie wariantów, panel admina) zna tylko te typy.
 * Żeby dodać nowego dostawcę, piszesz jeden plik w ./providers,
 * który implementuje `ImageProvider`, i rejestrujesz go w ./registry.ts.
 */

export type AspectRatio = "1:1" | "3:4" | "4:3" | "2:3" | "3:2" | "4:5" | "5:4";
export type Resolution = "1K" | "2K" | "4K";

export interface ReferenceImage {
  data: Buffer;
  mimeType: string;
}

export interface ImageGenerationRequest {
  prompt: string;
  /** Zdjęcie klienta (i ewentualnie inne obrazy referencyjne). */
  referenceImages: ReferenceImage[];
  aspectRatio: AspectRatio;
  resolution: Resolution;
  /** Ile obrazów zwrócić z jednego wywołania (większość modeli obsługuje tylko 1). */
  count: number;
  signal?: AbortSignal;
}

export interface GeneratedImage {
  data: Buffer;
  mimeType: string;
  /** Koszt w USD, jeśli dostawca go raportuje. */
  costUsd?: number;
}

/** Nazwy adapterów. Dodając nowy adapter, dopisz jego nazwę tutaj. */
export type ProviderId = "openrouter" | "gemini" | "mock";

/**
 * Preset modelu = konkretny model u konkretnego dostawcy + jego ustawienia.
 * Presety definiujesz w src/config/ai-models.ts, aktywny wybierasz w panelu admina.
 */
export interface ModelPreset {
  id: string;
  label: string;
  provider: ProviderId;
  /** Identyfikator modelu u dostawcy, np. "google/gemini-nano-banana-2.1". */
  model: string;
  resolution: Resolution;
  /**
   * true  = jedno wywołanie zwraca od razu wszystkie propozycje (parametr n),
   * false = sklep wysyła osobne równoległe zapytania (tak działa Nano Banana).
   */
  supportsBatch: boolean;
  /** Szacunkowy koszt jednego obrazu w USD – tylko do statystyk w panelu. */
  estCostUsdPerImage?: number;
  /** Ustawienia specyficzne dla adaptera (np. endpoint OpenRouter, thinking level Gemini). */
  options?: Record<string, unknown>;
  note?: string;
}

export interface ImageProvider {
  readonly id: ProviderId;
  /** Czy adapter ma wszystko, czego potrzebuje (np. klucz API). */
  isConfigured(): boolean;
  generate(req: ImageGenerationRequest, preset: ModelPreset): Promise<GeneratedImage[]>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly provider: ProviderId,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
