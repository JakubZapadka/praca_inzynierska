import type { AspectRatio, Resolution } from "./types";

const LONG_EDGE: Record<Resolution, number> = { "1K": 1024, "2K": 2048, "4K": 4096 };

export function ratioOf(aspect: AspectRatio): number {
  const [w, h] = aspect.split(":").map(Number);
  return w / h;
}

/** Przybliżony rozmiar w pikselach dla proporcji i rozdzielczości (używa go m.in. tryb testowy). */
export function pixelSize(aspect: AspectRatio, resolution: Resolution) {
  const ratio = ratioOf(aspect);
  const long = LONG_EDGE[resolution];
  return ratio >= 1
    ? { width: long, height: Math.round(long / ratio) }
    : { width: Math.round(long * ratio), height: long };
}
