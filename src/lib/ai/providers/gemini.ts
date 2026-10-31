import { env } from "@/lib/env";
import {
  ProviderError,
  type GeneratedImage,
  type ImageGenerationRequest,
  type ImageProvider,
  type ModelPreset,
} from "../types";

/**
 * Adapter Google Gemini API (Nano Banana) – bez pośredników.
 * Używa Interactions API: POST /v1beta/interactions
 * Dokumentacja: https://ai.google.dev/gemini-api/docs/image-generation
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

interface ContentBlock {
  type?: string;
  data?: string;
  mime_type?: string;
  text?: string;
}

interface InteractionResponse {
  output_image?: ContentBlock;
  steps?: Array<{ type?: string; content?: ContentBlock[] }>;
  error?: { message?: string; code?: number };
}

export class GeminiProvider implements ImageProvider {
  readonly id = "gemini" as const;

  isConfigured() {
    return Boolean(env.geminiApiKey);
  }

  async generate(req: ImageGenerationRequest, preset: ModelPreset): Promise<GeneratedImage[]> {
    if (!this.isConfigured()) {
      throw new ProviderError("Brak GEMINI_API_KEY w .env", this.id);
    }

    const body: Record<string, unknown> = {
      model: preset.model,
      input: [
        { type: "text", text: req.prompt },
        ...req.referenceImages.map((img) => ({
          type: "image",
          mime_type: img.mimeType,
          data: img.data.toString("base64"),
        })),
      ],
      response_format: {
        type: "image",
        mime_type: "image/png",
        aspect_ratio: req.aspectRatio,
        image_size: req.resolution,
      },
    };
    if (typeof preset.options?.thinkingLevel === "string") {
      body.generation_config = { thinking_level: preset.options.thinkingLevel };
    }

    // Gemini zwraca jeden obraz na wywołanie.
    return Promise.all(
      Array.from({ length: req.count }, () => this.callOnce(body, req.signal)),
    );
  }

  private async callOnce(body: unknown, signal?: AbortSignal): Promise<GeneratedImage> {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "x-goog-api-key": env.geminiApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });

    const text = await res.text();
    let json: InteractionResponse = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new ProviderError(`Nieczytelna odpowiedź Gemini (${res.status}).`, this.id, res.status);
    }
    if (!res.ok || json.error) {
      throw new ProviderError(`Gemini: ${json.error?.message ?? `HTTP ${res.status}`}`, this.id, res.status);
    }

    const image = pickFinalImage(json);
    if (!image?.data) {
      const reply = findText(json);
      throw new ProviderError(
        `Model nie zwrócił obrazu${reply ? `: ${reply.slice(0, 300)}` : " (możliwa blokada treści)"}.`,
        this.id,
      );
    }
    return { data: Buffer.from(image.data, "base64"), mimeType: image.mime_type ?? "image/png" };
  }
}

/** Ostatni obraz z kroku model_output (obrazy "myślowe" są w krokach thought i je pomijamy). */
function pickFinalImage(json: InteractionResponse): ContentBlock | undefined {
  if (json.output_image?.data) return json.output_image;
  const outputs = (json.steps ?? []).filter((s) => s.type === "model_output");
  for (const step of outputs.reverse()) {
    const img = [...(step.content ?? [])].reverse().find((c) => c.type === "image" && c.data);
    if (img) return img;
  }
  return undefined;
}

function findText(json: InteractionResponse): string {
  return (json.steps ?? [])
    .flatMap((s) => s.content ?? [])
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text)
    .join(" ");
}
