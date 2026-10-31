/**
 * Jedno miejsce, z którego kod czyta zmienne środowiskowe (.env).
 * Opis każdej zmiennej znajdziesz w pliku .env.example.
 */

function str(name: string, fallback = ""): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function int(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  get siteUrl() {
    return str("SITE_URL", "http://localhost:3000").replace(/\/$/, "");
  },
  get appSecret() {
    const secret = str("APP_SECRET");
    if (!secret && process.env.NODE_ENV === "production") {
      throw new Error("Ustaw APP_SECRET w zmiennych środowiskowych.");
    }
    return secret || "dev-secret-zmien-mnie";
  },
  get databaseUrl() {
    return str("DATABASE_URL", "file:./data/obrazio.db");
  },
  get databaseAuthToken() {
    return str("DATABASE_AUTH_TOKEN") || undefined;
  },
  get storageDir() {
    return str("STORAGE_DIR", "./storage");
  },

  // --- AI ---
  /** Preset używany, dopóki nie wybierzesz innego w panelu admina. */
  get defaultModelPreset() {
    return str("AI_MODEL_PRESET", "nano-banana-2.1-openrouter");
  },
  get openRouterApiKey() {
    return str("OPENROUTER_API_KEY");
  },
  get geminiApiKey() {
    return str("GEMINI_API_KEY");
  },
  get generationTimeoutMs() {
    return int("AI_TIMEOUT_SECONDS", 180) * 1000;
  },
  get generationsPerHourPerIp() {
    return int("GENERATIONS_PER_HOUR", 6);
  },

  // --- Płatności ---
  get stripeSecretKey() {
    return str("STRIPE_SECRET_KEY");
  },
  get stripeWebhookSecret() {
    return str("STRIPE_WEBHOOK_SECRET");
  },
  /** Testowa płatność bez Stripe – działa tylko, gdy nie ma klucza Stripe. */
  get allowDevCheckout() {
    if (this.stripeSecretKey) return false;
    return process.env.NODE_ENV !== "production" || str("ALLOW_DEV_CHECKOUT") === "true";
  },

  // --- Realizacja zamówień ---
  get fulfillmentProvider() {
    return str("FULFILLMENT_PROVIDER", "manual") as "gelato" | "manual";
  },
  get gelatoApiKey() {
    return str("GELATO_API_KEY");
  },
  /** "draft" = Gelato tylko zapisuje szkic (nic nie drukuje). Zmień na "order" po testach. */
  get gelatoOrderType() {
    return str("GELATO_ORDER_TYPE", "draft") as "draft" | "order";
  },
  get gelatoCurrency() {
    return str("GELATO_CURRENCY", "PLN");
  },
  get gelatoShipmentMethod() {
    return str("GELATO_SHIPMENT_METHOD") || undefined;
  },
  get gelatoWebhookToken() {
    return str("GELATO_WEBHOOK_TOKEN");
  },

  // --- Panel admina ---
  get adminUser() {
    return str("ADMIN_USER", "admin");
  },
  get adminPassword() {
    return str("ADMIN_PASSWORD");
  },
};
