@AGENTS.md

# Obraz z serca (obrazzserca.pl) – sklep z obrazami generowanymi przez AI (praca inżynierska)

Marka: „Obraz z serca”, rynek polski, odbiorcy raczej starsi; sklep pokazujemy jako pomysł na prezent
(np. dla nauczycielki, policjanta, pielęgniarki). Nazwa w `SITE.name`; wewnętrzne identyfikatory
(`obrazio.db`, nazwa paczki, klucz w localStorage) zostają „obrazio”, żeby nie gubić danych.

Klient przesyła zdjęcie + opis/styl → AI generuje 2 propozycje (`SITE.variantCount`) → klient wybiera jedną, rodzaj (plakat / rama / płótno),
rozmiar i kolor ramy → płaci przez Stripe → plik do druku trafia do drukarni (Gelato) z wysyłką do klienta.
Kluczowe wymaganie: **model AI można zmienić bez zmiany kodu** (panel admina) i łatwo dodać nowego dostawcę.

Interfejs sklepu i komentarze w kodzie są po polsku. Pisz teksty dla klienta po polsku, prostym językiem.

## Polecenia

- `npm run dev` – serwer deweloperski (przed startem sam uruchamia migracje bazy)
- `npm run build` / `npm start` – produkcja (`prestart` też uruchamia migracje)
- `npm test` – testy adapterów AI na podmienionym `fetch` (`tests/*.test.mts`)
- `npm run typecheck`, `npm run lint`
- `npm run db:generate` – po każdej zmianie `src/lib/db/schema.ts` (tworzy migrację w `drizzle/`)
- `npm run gelato:products -- <katalog> <filtr>` – szuka productUid w katalogu Gelato
- Lokalne testy bez kluczy: w `.env` ustaw `AI_MODEL_PRESET=mock` (bez `STRIPE_SECRET_KEY` działa testowa płatność)

Po zmianach uruchom `npm run typecheck`, `npm run lint` i `npm test`; przy zmianach stron także `npm run build`.

## Stos i pułapki tej wersji Next.js

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 (tokeny w `src/app/globals.css`, blok `@theme`).
- **Cache Components jest włączone** (`next.config.ts`): odczyty z bazy, `params` i `Date.now()` w komponentach
  serwerowych muszą być wewnątrz `<Suspense>`; strony zawsze dynamiczne wołają `await connection()` (patrz `/admin`).
- Zamiast `middleware.ts` jest `src/proxy.ts` (logowanie Basic do `/admin`).
- Długie prace po odpowiedzi HTTP: `after()` z `next/server` (generowanie obrazów, wysyłka do drukarni).
- Baza: Drizzle ORM + libSQL – ten sam kod dla pliku SQLite (`file:./data/obrazio.db`) i Turso w chmurze.
- Obrazy: `sharp` (normalizacja zdjęcia, podgląd ze znakiem wodnym, plik do druku 150 DPI).
- Czcionki z `@fontsource` (hostowane lokalnie, bez Google Fonts – ważne dla RODO).

## Architektura

```
src/config/        ← najczęściej edytowane: ai-models.ts, prompts.ts, products.ts, gelato-products.ts, site.ts
src/lib/ai/        ← warstwa AI
  types.ts           interfejs ImageProvider + ModelPreset (jedyne, co zna reszta sklepu)
  index.ts           rejestr adapterów, getActivePreset() (wybór z panelu > AI_MODEL_PRESET z .env)
  providers/         openrouter.ts (chat/completions lub /images, auto-fallback), gemini.ts (Interactions API), mock.ts
src/lib/fulfillment/ ← drukarnie z tym samym wzorcem adapterów: gelato.ts, manual.ts
src/lib/generation-service.ts  createGeneration → after(runGeneration) → front odpytuje GET /api/generations/:id co 2 s
src/lib/order-service.ts       startCheckout → webhook Stripe → markOrderPaid → after(fulfillOrder)
src/lib/storage.ts             pliki na dysku; previews/ publiczne, reszta tylko przez podpisany link (HMAC, APP_SECRET)
src/app/                       page.tsx (kreator), zamowienie/[id], admin/ (server actions w actions.ts), api/
src/components/                Creator (formularz + ściana propozycji), Configurator, FramedImage
```

- Nowy model: dopisz preset w `src/config/ai-models.ts`. Nowy dostawca: plik w `src/lib/ai/providers/`,
  dopisz do `ProviderId` w `types.ts` i do rejestru w `src/lib/ai/index.ts`, dodaj test w `tests/`.
- Modele bez `supportsBatch` dostają osobne równoległe zapytania (po jednym na wariant) z różnymi wskazówkami (`VARIATION_HINTS` w `prompts.ts`).
- Aktywny model zapisany jest w tabeli `settings` (klucz `ai.activeModelPreset`).

## Zasady, których pilnujemy

- Ceny w groszach (`7900` = 79,00 zł). Cena zawsze z katalogu na serwerze, nigdy z przeglądarki.
- Kwoty formatuj przez `formatPrice()` z `src/config/site.ts`; nie używaj `tabular-nums` przy cenach (psuje przecinek w tej czcionce).
- Oryginały z AI i zdjęcia klientów są prywatne; klient widzi tylko podglądy ze znakiem wodnym.
- Błędy dla klienta bez szczegółów technicznych (`publicError` w generation-service); szczegóły trafiają do bazy i panelu.
- Webhooki są idempotentne (`markOrderPaid` zmienia tylko zamówienia w stanie `pending_payment`).
- Nigdy nie commituj `.env`, `data/`, `storage/`.

## Wygląd (spójny motyw „pracowni ramiarskiej”)

- Kolory: ściana `wall` #dce1da, passe-partout `mat` #fff, tekst `ink` #24302a, drewno `oak` #b98a5a,
  akcent `cobalt` #2c45c4 tylko dla działań klienta, błędy `alert`.
- Czcionki: Gloock (nagłówki), Schibsted Grotesk (reszta).
- Motywem są obrazy w ramach na ścianie (`.frame` w globals.css). Unikaj etykiet WIELKIMI LITERAMI,
  ozdobnych gradientów i identycznych kart z cieniem.

## Stan projektu i otwarte sprawy

- Sprawdzone end-to-end na adapterze `mock` (generowanie → wybór → płatność testowa → plik do druku).
- **Nie sprawdzone na żywych API** (brak dostępu przy tworzeniu): OpenRouter, Google Gemini, Stripe, Gelato.
  Adaptery napisane wg dokumentacji z października 2026; przy pierwszym prawdziwym wywołaniu zweryfikuj odpowiedzi.
- Do zrobienia: productUid w `src/config/gelato-products.ts`; regulamin i polityka prywatności (stopka w `layout.tsx`);
  magazyn S3/R2 zamiast dysku przy wdrożeniu na Vercel; ewentualny upscaler dla dużych formatów;
  powiadomienia e-mail o zamówieniu (nie ma ich jeszcze).
