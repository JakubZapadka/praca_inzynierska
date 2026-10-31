/**
 * Jak sklep buduje polecenie dla AI.
 * Klient wybiera styl i może dopisać własny opis. Reszta (zasady druku) jest stała.
 */

export interface StylePreset {
  id: string;
  label: string;
  /** Opis stylu po angielsku – modele obrazowe rozumieją go najlepiej. */
  prompt: string;
}

export const STYLES: StylePreset[] = [
  { id: "free", label: "Tylko mój opis", prompt: "" },
  {
    id: "watercolor",
    label: "Akwarela",
    prompt: "a delicate watercolor painting with soft washes, visible paper grain and gentle bleeding edges",
  },
  {
    id: "oil",
    label: "Obraz olejny",
    prompt: "a classical oil painting on canvas with rich impasto brushstrokes and warm gallery lighting",
  },
  {
    id: "pencil",
    label: "Szkic ołówkiem",
    prompt: "a detailed graphite pencil drawing on textured paper with careful cross-hatching",
  },
  {
    id: "pop-art",
    label: "Pop-art",
    prompt: "bold pop-art screen print with flat saturated colors, halftone dots and thick outlines",
  },
  {
    id: "anime",
    label: "Ilustracja anime",
    prompt: "a hand-drawn anime illustration with clean line art, cel shading and a luminous background",
  },
  {
    id: "minimal",
    label: "Minimalistyczny plakat",
    prompt: "a minimalist mid-century poster with a limited palette of 4 colors and simple geometric shapes",
  },
  {
    id: "vintage",
    label: "Vintage, lata 70.",
    prompt: "a 1970s vintage travel-poster look with grainy texture, faded warm colors and soft sun flare",
  },
];

/**
 * Każdy wariant dostaje inną wskazówkę (wg kolejności), żeby klient miał realny wybór,
 * a nie prawie identyczne obrazy. Pierwszy trzyma się opisu najwierniej, drugi
 * jest najśmielszy – przy dwóch propozycjach daje to największą różnicę.
 */
export const VARIATION_HINTS = [
  "Stay faithful to the original photo's composition.",
  "Take a bolder, more artistic interpretation of the request.",
  "Try a slightly different, more dynamic composition or crop.",
  "Explore a different color palette and lighting mood.",
];

export function getStyle(id: string): StylePreset {
  return STYLES.find((s) => s.id === id) ?? STYLES[0];
}

export function buildPrompt(input: { userPrompt: string; styleId: string; variantIndex: number | null }) {
  const style = getStyle(input.styleId);
  const hint = input.variantIndex === null ? "" : VARIATION_HINTS[input.variantIndex % VARIATION_HINTS.length];

  return [
    "Use the attached photo as the reference and turn it into a piece of wall art that will be printed and framed.",
    style.prompt && `Style: ${style.prompt}.`,
    input.userPrompt && `Customer's wishes (may be in Polish): ${input.userPrompt}`,
    "Keep the people, animals and main subjects from the photo recognizable.",
    "Fill the entire canvas edge to edge. Do not add frames, borders, mockups, walls, watermarks, signatures or any text unless the customer explicitly asked for text.",
    hint,
  ]
    .filter(Boolean)
    .join("\n");
}
