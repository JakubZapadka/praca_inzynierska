import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { findProduct, orientationForAspect, productTitle, type Product } from "@/config/products";
import { SITE } from "@/config/site";
import { db, schema } from "@/lib/db";
import type { OrderStatus } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { getFulfillmentProvider, type ShippingAddress } from "@/lib/fulfillment";
import { makePrintFile } from "@/lib/images";
import { getStripe, isStripeConfigured } from "@/lib/payments/stripe";
import { storage } from "@/lib/storage";

export class OrderError extends Error {}

/** Tworzy zamówienie i zwraca adres, pod który przekierować klienta (Stripe Checkout). */
export async function startCheckout(input: { variantId: string; productId: string; quantity: number }) {
  const variant = await db.query.variants.findFirst({ where: eq(schema.variants.id, input.variantId) });
  if (!variant || variant.status !== "done") throw new OrderError("Ten obraz nie jest już dostępny.");
  const generation = await db.query.generations.findFirst({
    where: eq(schema.generations.id, variant.generationId),
  });
  if (!generation) throw new OrderError("Ten obraz nie jest już dostępny.");

  const product = findProduct(input.productId);
  const orientation = orientationForAspect(generation.aspectRatio);
  if (!product || (product.size.shape === "square") !== (orientation === "square")) {
    throw new OrderError("Ten produkt nie pasuje do kształtu obrazu.");
  }
  const quantity = Math.min(Math.max(Math.trunc(input.quantity) || 1, 1), 10);

  const orderId = randomUUID();
  await db.insert(schema.orders).values({
    id: orderId,
    status: "pending_payment",
    variantId: variant.id,
    productId: product.id,
    orientation,
    quantity,
    itemPrice: product.price, // cena zawsze z katalogu, nigdy z przeglądarki
    shippingPrice: SITE.shippingPrice,
    currency: SITE.currency,
  });

  if (!isStripeConfigured()) {
    if (!env.allowDevCheckout) throw new OrderError("Płatności nie są jeszcze skonfigurowane.");
    return { orderId, url: `/zamowienie/${orderId}/test-platnosci` };
  }

  const preview = variant.previewKey ? storage.url(variant.previewKey, { absolute: true }) : undefined;
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    locale: "pl",
    line_items: [
      {
        quantity,
        price_data: {
          currency: SITE.currency,
          unit_amount: product.price,
          product_data: {
            name: productTitle(product, orientation),
            // Stripe pokaże miniaturę tylko z publicznego adresu https.
            ...(preview?.startsWith("https://") ? { images: [preview] } : {}),
          },
        },
      },
    ],
    shipping_address_collection: { allowed_countries: [...SITE.shippingCountries] },
    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: SITE.shippingLabel,
          fixed_amount: { amount: SITE.shippingPrice, currency: SITE.currency },
        },
      },
    ],
    phone_number_collection: { enabled: true },
    client_reference_id: orderId,
    metadata: { orderId },
    success_url: `${env.siteUrl}/zamowienie/${orderId}`,
    cancel_url: `${env.siteUrl}/?platnosc=anulowana`,
  });

  await db.update(schema.orders).set({ stripeSessionId: session.id }).where(eq(schema.orders.id, orderId));
  if (!session.url) throw new OrderError("Stripe nie zwrócił adresu płatności.");
  return { orderId, url: session.url };
}

/** Wywoływane po potwierdzeniu płatności (webhook Stripe lub test). Zwraca true, jeśli zmieniło stan. */
export async function markOrderPaid(
  orderId: string,
  details: {
    email: string;
    name: string;
    phone?: string;
    address: ShippingAddress;
    amountTotal?: number;
  },
) {
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
  if (!order || order.status !== "pending_payment") return false; // webhook może przyjść kilka razy

  await updateOrder(orderId, {
    status: "paid",
    customerEmail: details.email,
    customerName: details.name,
    customerPhone: details.phone ?? null,
    shippingAddress: JSON.stringify(details.address),
    amountTotal: details.amountTotal ?? order.itemPrice * order.quantity + order.shippingPrice,
  });
  return true;
}

/** Przygotowuje plik do druku i przekazuje zamówienie do drukarni. Można wywołać ponownie z panelu. */
export async function fulfillOrder(orderId: string) {
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
  if (!order || !["paid", "needs_attention"].includes(order.status)) return;

  try {
    const product = findProduct(order.productId) as Product;
    const variant = await db.query.variants.findFirst({ where: eq(schema.variants.id, order.variantId) });
    if (!variant?.imageKey) throw new Error("Brak oryginalnego obrazu dla zamówienia.");

    let printFileKey = order.printFileKey;
    if (!printFileKey) {
      const print = await makePrintFile(await storage.get(variant.imageKey), product, order.orientation);
      printFileKey = `print/${order.id}.jpg`;
      await storage.put(printFileKey, print.data);
      if (print.upscale > 1.5) {
        console.warn(`[zamówienie ${order.id}] obraz powiększony ${print.upscale.toFixed(1)}x do druku`);
      }
      await updateOrder(order.id, { printFileKey });
    }

    const provider = getFulfillmentProvider();
    const result = await provider.submit({
      orderId: order.id,
      product,
      orientation: order.orientation,
      quantity: order.quantity,
      printFileUrl: storage.url(printFileKey, { absolute: true, ttlSeconds: 14 * 24 * 3600 }),
      customer: { email: order.customerEmail ?? "", phone: order.customerPhone ?? undefined },
      shippingAddress: JSON.parse(order.shippingAddress ?? "{}"),
    });

    await updateOrder(order.id, {
      status: result.submitted ? "submitted" : "needs_attention",
      fulfillmentProvider: provider.id,
      fulfillmentOrderId: result.externalId,
      error: result.message ?? null,
    });
  } catch (error) {
    console.error(`[zamówienie ${orderId}] realizacja:`, error);
    await updateOrder(orderId, {
      status: "needs_attention",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function updateOrder(id: string, values: Partial<typeof schema.orders.$inferInsert>) {
  await db
    .update(schema.orders)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(schema.orders.id, id));
}

export async function setOrderStatus(id: string, status: OrderStatus, extra: { trackingUrl?: string } = {}) {
  await updateOrder(id, { status, ...(extra.trackingUrl ? { trackingUrl: extra.trackingUrl } : {}) });
}

export async function getOrderView(id: string) {
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, id) });
  if (!order) return null;
  const variant = await db.query.variants.findFirst({ where: eq(schema.variants.id, order.variantId) });
  const product = findProduct(order.productId);
  return {
    order,
    product,
    title: product ? productTitle(product, order.orientation) : order.productId,
    previewUrl: variant?.previewKey ? storage.url(variant.previewKey) : null,
  };
}

export async function listOrders(limit = 50) {
  return db.query.orders.findMany({ orderBy: desc(schema.orders.createdAt), limit });
}
