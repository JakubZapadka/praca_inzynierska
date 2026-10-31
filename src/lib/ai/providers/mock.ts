import sharp from "sharp";
import type { GeneratedImage, ImageGenerationRequest, ImageProvider } from "../types";
import { pixelSize } from "../sizes";

/**
 * Adapter testowy: nie łączy się z żadnym AI, tylko przerabia zdjęcie klienta
 * czterema filtrami. Pozwala przetestować cały sklep (aż do płatności) za darmo.
 */

type Img = ReturnType<typeof sharp>;

const FILTERS: Array<(img: Img) => Img> = [
  (img) => img.modulate({ saturation: 1.6, brightness: 1.05 }).sharpen(),
  (img) => img.grayscale().linear(1.25, -20).tint({ r: 92, g: 70, b: 48 }),
  (img) => img.modulate({ hue: 160, saturation: 1.3 }),
  (img) => img.blur(3).modulate({ saturation: 0.6, brightness: 1.15 }).linear(0.85, 30),
];

export class MockProvider implements ImageProvider {
  readonly id = "mock" as const;

  isConfigured() {
    return true;
  }

  async generate(req: ImageGenerationRequest): Promise<GeneratedImage[]> {
    const source = req.referenceImages[0];
    if (!source) throw new Error("Tryb testowy wymaga zdjęcia.");
    const { width, height } = pixelSize(req.aspectRatio, req.resolution);
    const offset = hash(req.prompt) % FILTERS.length;

    return Promise.all(
      Array.from({ length: req.count }, async (_, i) => {
        await sleep(900 + Math.random() * 2200); // udaje czas pracy modelu
        const filter = FILTERS[(offset + i) % FILTERS.length];
        const data = await filter(sharp(source.data).rotate().resize(width, height, { fit: "cover" }))
          .png()
          .toBuffer();
        return { data, mimeType: "image/png", costUsd: 0 };
      }),
    );
  }
}

function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
