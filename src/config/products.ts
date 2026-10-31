import type { AspectRatio } from "@/lib/ai/types";

/**
 * KATALOG PRODUKTÓW
 * Ceny są przykładowe – ustaw własne. Kwoty w groszach (7900 = 79,00 zł).
 * Identyfikatory produktów Gelato uzupełnij w src/config/gelato-products.ts.
 */

export type Orientation = "portrait" | "landscape" | "square";
export type ProductKind = "poster" | "framed" | "canvas";
export type FrameColor = "black" | "white" | "oak";

/** Kształt, który klient wybiera PRZED generowaniem – od niego zależą proporcje obrazu z AI. */
export const ORIENTATIONS: Record<Orientation, { label: string; aspect: AspectRatio }> = {
  portrait: { label: "Pionowy", aspect: "3:4" },
  landscape: { label: "Poziomy", aspect: "4:3" },
  square: { label: "Kwadrat", aspect: "1:1" },
};

export const KINDS: Record<ProductKind, { label: string; description: string }> = {
  poster: { label: "Plakat", description: "Gruby papier matowy 200 g/m², bez ramy" },
  framed: { label: "Plakat w ramie", description: "Drewniana rama z pleksi, gotowa do powieszenia" },
  canvas: { label: "Obraz na płótnie", description: "Płótno naciągnięte na drewniany blejtram" },
};

export const FRAMES: Record<FrameColor, { label: string; color: string }> = {
  black: { label: "Czarna", color: "#22201d" },
  white: { label: "Biała", color: "#f3f2ee" },
  oak: { label: "Dąb", color: "#b98a5a" },
};

interface SizeDef {
  id: string;
  /** Krótszy i dłuższy bok w cm. */
  shortCm: number;
  longCm: number;
  shape: "rect" | "square";
}

export const SIZES: SizeDef[] = [
  { id: "30x40", shortCm: 30, longCm: 40, shape: "rect" },
  { id: "45x60", shortCm: 45, longCm: 60, shape: "rect" },
  { id: "60x80", shortCm: 60, longCm: 80, shape: "rect" },
  { id: "30x30", shortCm: 30, longCm: 30, shape: "square" },
  { id: "50x50", shortCm: 50, longCm: 50, shape: "square" },
];

const PRICES: Record<ProductKind, Record<string, number>> = {
  poster: { "30x40": 7900, "45x60": 11900, "60x80": 15900, "30x30": 6900, "50x50": 11900 },
  framed: { "30x40": 19900, "45x60": 27900, "60x80": 35900, "30x30": 17900, "50x50": 27900 },
  canvas: { "30x40": 18900, "45x60": 25900, "60x80": 32900, "30x30": 16900, "50x50": 25900 },
};

export interface Product {
  id: string;
  kind: ProductKind;
  frame?: FrameColor;
  size: SizeDef;
  price: number;
}

export const PRODUCTS: Product[] = (Object.keys(KINDS) as ProductKind[]).flatMap((kind) =>
  SIZES.flatMap((size): Product[] => {
    const price = PRICES[kind][size.id];
    if (!price) return [];
    if (kind === "framed") {
      return (Object.keys(FRAMES) as FrameColor[]).map((frame) => ({
        id: `${kind}-${size.id}-${frame}`,
        kind,
        frame,
        size,
        price,
      }));
    }
    return [{ id: `${kind}-${size.id}`, kind, size, price }];
  }),
);

export function findProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function productsFor(orientation: Orientation): Product[] {
  const shape = orientation === "square" ? "square" : "rect";
  return PRODUCTS.filter((p) => p.size.shape === shape);
}

/** Wymiary w cm w kolejności szerokość × wysokość dla danej orientacji. */
export function dimensionsCm(product: Product, orientation: Orientation) {
  const { shortCm, longCm } = product.size;
  return orientation === "landscape" ? { width: longCm, height: shortCm } : { width: shortCm, height: longCm };
}

export function productTitle(product: Product, orientation: Orientation): string {
  const { width, height } = dimensionsCm(product, orientation);
  const frame = product.frame ? `, rama ${FRAMES[product.frame].label.toLowerCase()}` : "";
  return `${KINDS[product.kind].label} ${width}×${height} cm${frame}`;
}

export function orientationForAspect(aspect: string): Orientation {
  const entry = (Object.entries(ORIENTATIONS) as [Orientation, { aspect: string }][]).find(
    ([, o]) => o.aspect === aspect,
  );
  return entry?.[0] ?? "portrait";
}
