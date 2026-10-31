# Obraz z serca (obrazzserca.pl) – sklep z obrazami generowanymi przez AI

Klient przesyła zdjęcie i opis → AI maluje **2 propozycje** → klient wybiera jedną, rozmiar i ramę →
płaci przez **Stripe** → plik do druku trafia automatycznie do **Gelato**, które drukuje i wysyła obraz do domu.

Model AI wybierasz w panelu admina i zmieniasz jednym kliknięciem, bez zmiany kodu.

---

## Szybki start (5 minut, bez żadnych kluczy)

Wymagany Node.js 20.12 lub nowszy.

```bash
npm install
cp .env.example .env
```

W pliku `.env` ustaw `AI_MODEL_PRESET=mock` i uruchom:

```bash
npm run dev
```

Otwórz http://localhost:3000. Tryb `mock` zamiast AI przerabia zdjęcie filtrami, a bez klucza Stripe
sklep pokazuje testową stronę płatności – możesz przejść cały proces aż do zamówienia.
Panel admina: http://localhost:3000/admin (lokalnie bez hasła, na serwerze ustaw `ADMIN_PASSWORD`).

## Włączenie prawdziwego AI (Nano Banana 2.1)

**Wariant A – OpenRouter (zalecany na start).** Jeden klucz daje dostęp do Nano Banana i setek innych modeli.

1. Załóż konto na https://openrouter.ai, doładuj kredyty, utwórz klucz.
2. W `.env`: `OPENROUTER_API_KEY=...` i `AI_MODEL_PRESET=nano-banana-2.1-openrouter`.

**Wariant B – Google bezpośrednio.** Bez pośrednika, ale tylko modele Google.

1. Klucz z https://aistudio.google.com/apikey (projekt musi mieć włączone rozliczanie – Nano Banana 2.1 nie ma darmowego progu).
2. W `.env`: `GEMINI_API_KEY=...`, a w panelu wybierz „Nano Banana 2.1 – bezpośrednio przez Google”.

Możesz mieć ustawione oba klucze i przełączać się w panelu.

### Koszt

Nano Banana 2.1 w rozdzielczości 2K to ok. 0,05 USD za obraz, więc **jeden zestaw 2 propozycji ≈ 0,10 USD**
(4K: ok. 0,11 USD za obraz). Koszt widzisz w panelu w sekcji „Ostatnie generowania”.
Przed nadużyciami chroni limit `GENERATIONS_PER_HOUR` na adres IP.

---

## Jak działa przełączanie modeli

```
            ┌──────────── src/config/ai-models.ts ────────────┐
 panel ───► │ preset: dostawca + model + rozdzielczość + opcje │
 admina     └───────────────────────┬─────────────────────────┘
                                    ▼
             src/lib/ai/index.ts  →  getProvider(preset.provider)
                                    ▼
      ┌──────────────┬──────────────┴──────┬───────────────┐
  openrouter.ts   gemini.ts            mock.ts        (Twój adapter)
      └──────────────┴──── wspólny interfejs ImageProvider ┘
```

Reszta sklepu zna tylko interfejs `ImageProvider` (`src/lib/ai/types.ts`):
dostaje prompt + zdjęcie, zwraca obrazy. Dlatego:

| Chcę…                                   | Co robię                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------ |
| przełączyć się na inny gotowy model     | wybieram go w `/admin` → „Zapisz wybór modelu”                            |
| użyć dowolnego modelu z OpenRouter       | w `/admin` wybieram „Dowolny model z OpenRouter” i wpisuję jego nazwę     |
| dodać model na stałe do listy            | dopisuję obiekt w `src/config/ai-models.ts`                               |
| podłączyć nowego dostawcę (np. fal.ai)  | piszę 1 plik w `src/lib/ai/providers/` i rejestruję go w `src/lib/ai/index.ts` |

Szkielet nowego adaptera:

```ts
// src/lib/ai/providers/moj-dostawca.ts
export class MojDostawcaProvider implements ImageProvider {
  readonly id = "moj-dostawca" as const;          // dopisz też do ProviderId w types.ts
  isConfigured() { return Boolean(process.env.MOJ_KLUCZ); }
  async generate(req: ImageGenerationRequest, preset: ModelPreset) {
    // req.prompt, req.referenceImages[0].data (Buffer), req.aspectRatio, req.resolution
    const res = await fetch("https://api.dostawcy/...", { method: "POST", body: ..., signal: req.signal });
    return [{ data: Buffer.from(...), mimeType: "image/png" }];
  }
}
```

Nazwy modeli na OpenRouter sprawdzisz na https://openrouter.ai/models?output_modalities=image
(model musi przyjmować obraz na wejściu). Testy adapterów: `npm test`.

### Jak powstają różne propozycje

`src/config/prompts.ts` buduje polecenie dla AI: zasady druku + styl wybrany przez klienta + jego opis.
Każdy wariant dostaje inną wskazówkę (`VARIATION_HINTS`), żeby propozycje faktycznie się różniły.
Modele obsługujące wiele obrazów w jednym wywołaniu (`supportsBatch: true`) dostają jedno zapytanie,
pozostałe – po jednym równoległym na wariant. Liczbę propozycji ustawia `SITE.variantCount` w `src/config/site.ts`. Klient widzi obrazy na ścianie od razu, gdy każdy z nich jest gotowy.

---

## Płatności – Stripe

1. Klucz z https://dashboard.stripe.com/apikeys → `STRIPE_SECRET_KEY` (na start klucz testowy `sk_test_…`).
2. W panelu Stripe → **Settings → Payment methods** włącz **BLIK**, **Przelewy24** i karty
   (Checkout pokaże je automatycznie dla PLN).
3. Webhook: **Developers → Webhooks → Add endpoint**
   `https://twoja-domena/api/webhooks/stripe`, zdarzenia `checkout.session.completed`
   i `checkout.session.async_payment_succeeded`. Sekret → `STRIPE_WEBHOOK_SECRET`.
4. Lokalnie zamiast punktu 3: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

Adres dostawy i telefon klient podaje na stronie Stripe. Ceny zawsze pochodzą z katalogu na serwerze.

## Druk i wysyłka – Gelato

1. Klucz z https://dashboard.gelato.com → Developer → API keys.
2. W `.env`: `FULFILLMENT_PROVIDER=gelato`, `GELATO_API_KEY=...`, na początek `GELATO_ORDER_TYPE=draft`.
3. **Uzupełnij `src/config/gelato-products.ts`** – przypisz każdemu produktowi sklepu jego `productUid` z Gelato.
   Pomoże skrypt: `npm run gelato:products` (lista katalogów), potem np.
   `npm run gelato:products -- posters 300x400`.
4. Webhook statusów (opcjonalnie): `https://twoja-domena/api/webhooks/gelato?token=GELATO_WEBHOOK_TOKEN`.
5. Po testowym zamówieniu (widocznym w Gelato jako szkic) zmień `GELATO_ORDER_TYPE=order`.

Gdy czegoś brakuje (np. `productUid`), opłacone zamówienie dostaje w panelu status „Wymaga uwagi”
z opisem problemu i przyciskiem „Wyślij do drukarni ponownie”. Z `FULFILLMENT_PROVIDER=manual`
pobierasz gotowy plik do druku z panelu i drukujesz u siebie.

**Gelato musi pobrać plik do druku z Twojego serwera**, więc `SITE_URL` musi być publicznym adresem.

### Jakość druku

Plik do druku jest przycinany do proporcji produktu i skalowany do 150 DPI
(np. 60×80 cm → 3543×4724 px). Obraz 2K z AI jest przy dużych formatach powiększany ok. 2×.
Jeśli sprzedajesz głównie duże formaty, ustaw w presecie `resolution: "4K"` (droższe) albo dodaj
krok powiększania (upscaler) tylko dla zamówionego obrazu w `fulfillOrder` w `src/lib/order-service.ts`.

---

## Produkty i ceny

`src/config/products.ts` – rodzaje (plakat, rama, płótno), rozmiary, kolory ram i ceny w groszach.
`src/config/site.ts` – nazwa sklepu, koszt i kraje wysyłki. Ceny w repozytorium są przykładowe.

## Wdrożenie na serwer

Najprościej: serwer z trwałym dyskiem (VPS, Railway, Render, Fly.io z wolumenem).

```bash
npm ci
npm run build
npm start          # przed startem sam tworzy/aktualizuje tabele w bazie
```

Ustaw zmienne z `.env.example` (koniecznie `SITE_URL`, `APP_SECRET`, `ADMIN_PASSWORD`).
Dane trzymane są w `./data` (baza SQLite) i `./storage` (zdjęcia, obrazy, pliki do druku) – rób ich kopie.

**Vercel / serverless:** dysk jest tam tymczasowy. Potrzebujesz bazy Turso
(`DATABASE_URL=libsql://…`) i magazynu plików S3/Cloudflare R2 zamiast `src/lib/storage.ts`.

## Zanim zaczniesz sprzedawać

- Regulamin sklepu i polityka prywatności (link w stopce – `src/app/layout.tsx`).
- RODO: zdjęcia klientów przetwarza dostawca AI (Google lub OpenRouter), Stripe i Gelato –
  wymień ich w polityce prywatności. Ustal, jak długo trzymasz zdjęcia w `storage/uploads`.
- Obrazy personalizowane zwykle są wyłączone z 14-dniowego prawa odstąpienia od umowy –
  zapisz to w regulaminie i skonsultuj z prawnikiem.
- Ustaw `ADMIN_PASSWORD` i długi `APP_SECRET`.

## Struktura projektu

```
src/
  config/            ← to edytujesz najczęściej
    ai-models.ts       lista modeli AI w panelu
    prompts.ts         style i budowa polecenia dla AI
    products.ts        produkty i ceny
    gelato-products.ts identyfikatory produktów Gelato
    site.ts            nazwa, wysyłka, waluta
  lib/
    ai/                warstwa AI: interfejs + adaptery (openrouter, gemini, mock)
    fulfillment/       drukarnie: gelato, manual
    payments/stripe.ts
    generation-service.ts  warianty, limity, podglądy ze znakiem wodnym
    order-service.ts       zamówienia, plik do druku, przekazanie do drukarni
    images.ts, storage.ts, db/
  app/
    page.tsx               strona główna z kreatorem
    zamowienie/[id]/       status zamówienia (+ testowa płatność)
    admin/                 panel: model AI, zamówienia, koszty
    api/                   generations, checkout, webhooks, files
  components/              kreator, ściana z propozycjami, konfigurator ramy
```

Polecenia: `npm run dev`, `npm run build`, `npm start`, `npm test`, `npm run typecheck`, `npm run lint`,
`npm run db:generate` (po zmianie `src/lib/db/schema.ts`).
