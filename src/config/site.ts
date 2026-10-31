/** Podstawowe dane sklepu. Zmień nazwę, wysyłkę i kraje dostawy pod siebie. */
export const SITE = {
  name: "Obraz z serca",
  /** Adres sklepu (domena obrazzserca.pl). */
  domain: "obrazzserca.pl",
  tagline: "Obraz ze zdjęcia w prezencie, który zostaje na ścianie",
  currency: "pln",
  /** Cena wysyłki w groszach (1999 = 19,99 zł). */
  shippingPrice: 1999,
  shippingLabel: "Kurier, 3–7 dni roboczych",
  /** Kody krajów (ISO), do których wysyłasz. */
  shippingCountries: ["PL", "DE", "CZ", "SK", "AT", "LT"] as const,
  maxUploadMb: 12,
  /** Ile propozycji AI maluje za jednym razem (1–4). Teksty na stronie mówią „dwie” – popraw je przy zmianie. */
  variantCount: 2,
  /** Minimalna rozdzielczość druku. 150 DPI to rozsądne minimum dla plakatów oglądanych z odległości. */
  printDpi: 150,
};

export function formatPrice(grosze: number): string {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(grosze / 100);
}
