import type { ReferenceImage } from "./types";

export function toDataUrl(img: ReferenceImage): string {
  return `data:${img.mimeType};base64,${img.data.toString("base64")}`;
}

export function dataUrlToImage(url: string): { data: Buffer; mimeType: string } {
  const match = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(url);
  if (!match) throw new Error("Niepoprawny data URL obrazu.");
  const [, mimeType, isBase64, payload] = match;
  return {
    mimeType,
    data: isBase64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload)),
  };
}

/** Odrzuca obietnicę po upływie czasu i przerywa zapytanie HTTP. */
export async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Przekroczono limit czasu (${ms / 1000}s).`)), ms);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}
