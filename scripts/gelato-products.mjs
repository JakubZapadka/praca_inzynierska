/**
 * Pomocnik: wyszukuje identyfikatory produktów (productUid) w katalogu Gelato.
 *
 *   npm run gelato:products                 -> lista katalogów
 *   npm run gelato:products -- posters 300x400   -> productUid z katalogu "posters" zawierające "300x400"
 *
 * Wynik wklej do src/config/gelato-products.ts.
 */
try {
  process.loadEnvFile(".env");
} catch {}

const key = process.env.GELATO_API_KEY;
if (!key) {
  console.error("Ustaw GELATO_API_KEY w pliku .env");
  process.exit(1);
}

const [catalog, ...filters] = process.argv.slice(2);
const headers = { "X-API-KEY": key, "Content-Type": "application/json" };
const BASE = "https://product.gelatoapis.com/v3/catalogs";

if (!catalog) {
  const res = await fetch(BASE, { headers });
  const json = await res.json();
  console.log("Dostępne katalogi (podaj nazwę jako pierwszy argument):");
  for (const c of json.data ?? json) console.log(`  ${c.catalogUid}  – ${c.title}`);
  process.exit(0);
}

let offset = 0;
const found = [];
for (;;) {
  const res = await fetch(`${BASE}/${catalog}/products:search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ limit: 100, offset }),
  });
  if (!res.ok) {
    console.error(`Błąd ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const json = await res.json();
  const products = json.products ?? [];
  for (const p of products) {
    if (filters.every((f) => p.productUid.includes(f))) found.push(p.productUid);
  }
  if (products.length < 100) break;
  offset += 100;
}
console.log(found.length ? found.join("\n") : "Nic nie pasuje. Spróbuj innego filtra.");
