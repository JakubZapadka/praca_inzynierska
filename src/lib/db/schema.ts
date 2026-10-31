import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

/** Jedna sesja generowania: zdjęcie + prompt -> kilka wariantów (SITE.variantCount). */
export const generations = sqliteTable(
  "generations",
  {
    id: text("id").primaryKey(),
    createdAt: createdAt(),
    status: text("status", { enum: ["running", "done", "failed"] }).notNull(),
    prompt: text("prompt").notNull(),
    styleId: text("style_id").notNull(),
    aspectRatio: text("aspect_ratio").notNull(),
    sourceKey: text("source_key").notNull(),
    modelPresetId: text("model_preset_id").notNull(),
    modelName: text("model_name").notNull(),
    ipHash: text("ip_hash").notNull(),
    /** Adres IP klienta do podglądu w panelu (dane osobowe – wymień w polityce prywatności). Puste w starszych wpisach. */
    ip: text("ip"),
    costUsd: real("cost_usd"),
    error: text("error"),
  },
  (t) => [index("generations_ip_idx").on(t.ipHash, t.createdAt)],
);

export const variants = sqliteTable(
  "variants",
  {
    id: text("id").primaryKey(),
    generationId: text("generation_id")
      .notNull()
      .references(() => generations.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    status: text("status", { enum: ["pending", "done", "failed"] }).notNull(),
    imageKey: text("image_key"),
    previewKey: text("preview_key"),
    width: integer("width"),
    height: integer("height"),
    error: text("error"),
  },
  (t) => [index("variants_generation_idx").on(t.generationId)],
);

export const ORDER_STATUSES = [
  "pending_payment", // czeka na płatność
  "paid", // opłacone, trwa przygotowanie pliku do druku
  "submitted", // przekazane do drukarni
  "in_production",
  "shipped",
  "delivered",
  "needs_attention", // coś poszło nie tak – sprawdź w panelu
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    status: text("status", { enum: ORDER_STATUSES }).notNull(),
    variantId: text("variant_id")
      .notNull()
      .references(() => variants.id),
    productId: text("product_id").notNull(),
    orientation: text("orientation", { enum: ["portrait", "landscape", "square"] }).notNull(),
    quantity: integer("quantity").notNull().default(1),
    /** Kwoty w groszach. */
    itemPrice: integer("item_price").notNull(),
    shippingPrice: integer("shipping_price").notNull(),
    amountTotal: integer("amount_total"),
    currency: text("currency").notNull(),
    stripeSessionId: text("stripe_session_id"),
    customerEmail: text("customer_email"),
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),
    /** JSON z adresem dostawy (ShippingAddress). */
    shippingAddress: text("shipping_address"),
    printFileKey: text("print_file_key"),
    fulfillmentProvider: text("fulfillment_provider"),
    fulfillmentOrderId: text("fulfillment_order_id"),
    trackingUrl: text("tracking_url"),
    error: text("error"),
  },
  (t) => [index("orders_status_idx").on(t.status)],
);

/** Proste ustawienia klucz-wartość (np. aktywny model AI wybrany w panelu). */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type Generation = typeof generations.$inferSelect;
export type Variant = typeof variants.$inferSelect;
export type Order = typeof orders.$inferSelect;
