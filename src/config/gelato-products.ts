import type { Orientation } from "./products";

/**
 * MAPOWANIE PRODUKTÓW SKLEPU NA PRODUKTY GELATO (productUid)
 *
 * Gelato rozpoznaje produkt po długim identyfikatorze "productUid", który koduje
 * rozmiar, papier, ramę i orientację. Znajdziesz je:
 *   - w panelu Gelato (Products → wybierz produkt → szczegóły / API),
 *   - albo skryptem:  npm run gelato:products -- 300x400
 *     (wymaga GELATO_API_KEY w .env, wypisuje pasujące productUid).
 *
 * Dopóki produkt nie ma tu wpisu, opłacone zamówienie dostanie status
 * "Wymaga uwagi" w panelu admina zamiast trafić do druku.
 *
 * Klucz = id produktu ze sklepu (src/config/products.ts), np. "framed-30x40-black".
 */
export const GELATO_PRODUCT_UIDS: Record<string, Partial<Record<Orientation, string>>> = {
  // Przykład (sprawdź identyfikatory w swoim katalogu Gelato przed użyciem):
  // "poster-30x40": {
  //   portrait: "flat_300x400-mm-12x16-inch_200-gsm-80lb-uncoated_4-0_ver",
  //   landscape: "flat_300x400-mm-12x16-inch_200-gsm-80lb-uncoated_4-0_hor",
  // },
};
