import sharp from "sharp";
import { SITE } from "@/config/site";
import { dimensionsCm, type Orientation, type Product } from "@/config/products";

/**
 * Akceptowane formaty zdjęć od klienta.
 * iPhone przy wyborze zdjęcia przez przeglądarkę sam zamienia HEIC na JPEG.
 */
export const ACCEPTED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Zdjęcie klienta: obraca wg EXIF, usuwa metadane (np. GPS), zmniejsza do 2048 px
 * i zapisuje jako JPEG. Mniejszy plik = szybsze i tańsze zapytanie do AI.
 */
export async function normalizeUpload(input: Buffer) {
  let img: ReturnType<typeof sharp>;
  try {
    img = sharp(input, { failOn: "error" });
    const meta = await img.metadata();
    if (!meta.width || !meta.height) throw new Error();
    if (Math.min(meta.width, meta.height) < 400) {
      throw new UploadError("Zdjęcie jest za małe. Wybierz plik o boku co najmniej 400 px.");
    }
  } catch (error) {
    if (error instanceof UploadError) throw error;
    throw new UploadError("Nie udało się odczytać zdjęcia. Prześlij plik JPG, PNG lub WEBP.");
  }
  const data = await img
    .rotate()
    .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
  return { data, mimeType: "image/jpeg" };
}

export class UploadError extends Error {}

/** Podgląd dla klienta: mniejszy, ze znakiem wodnym – oryginał zostaje prywatny. */
export async function makePreview(original: Buffer) {
  const resized = await sharp(original)
    .rotate()
    .resize(1000, 1000, { fit: "inside" })
    .toBuffer({ resolveWithObject: true });
  const { width, height } = resized.info;

  const label = `${SITE.name} · podgląd`;
  const step = 260;
  const marks: string[] = [];
  for (let y = -height; y < height * 2; y += step) {
    for (let x = -width; x < width * 2; x += step * 1.6) {
      marks.push(`<text x="${x}" y="${y}">${escapeXml(label)}</text>`);
    }
  }
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <g transform="rotate(-28 ${width / 2} ${height / 2})"
         font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="22" font-weight="600"
         fill="#ffffff" fill-opacity="0.32" stroke="#000000" stroke-opacity="0.12" stroke-width="0.6">
        ${marks.join("")}
      </g>
    </svg>`,
  );

  const data = await sharp(resized.data).composite([{ input: svg }]).webp({ quality: 82 }).toBuffer();
  return { data, width, height };
}

/**
 * Plik do drukarni: dokładne proporcje produktu, rozdzielczość SITE.printDpi.
 * Obraz jest kadrowany od środka, a w razie potrzeby powiększany (Lanczos).
 */
export async function makePrintFile(original: Buffer, product: Product, orientation: Orientation) {
  const { width: wCm, height: hCm } = dimensionsCm(product, orientation);
  const toPx = (cm: number) => Math.round((cm / 2.54) * SITE.printDpi);
  const width = toPx(wCm);
  const height = toPx(hCm);

  const meta = await sharp(original).metadata();
  const upscale = Math.max(width / (meta.width ?? width), height / (meta.height ?? height));

  const data = await sharp(original)
    .rotate()
    .resize(width, height, { fit: "cover", position: "centre", kernel: "lanczos3" })
    .toColourspace("srgb")
    .withMetadata({ density: SITE.printDpi })
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .toBuffer();

  return { data, width, height, upscale };
}

function escapeXml(text: string) {
  return text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
