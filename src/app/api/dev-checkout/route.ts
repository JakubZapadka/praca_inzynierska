import { after } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { fulfillOrder, markOrderPaid } from "@/lib/order-service";
import { jsonError } from "@/lib/request";

/**
 * POST /api/dev-checkout – TESTOWA płatność, gdy Stripe nie jest skonfigurowany.
 * Wyłącza się sama po dodaniu STRIPE_SECRET_KEY oraz na produkcji.
 */
const Body = z.object({
  orderId: z.string(),
  email: z.email(),
  name: z.string().min(2),
  phone: z.string().optional(),
  line1: z.string().min(2),
  city: z.string().min(2),
  postalCode: z.string().min(3),
  country: z.string().length(2),
});

export async function POST(request: Request) {
  if (!env.allowDevCheckout) return jsonError("Testowe płatności są wyłączone.", 403);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Uzupełnij wszystkie pola adresu.");

  const d = parsed.data;
  const changed = await markOrderPaid(d.orderId, {
    email: d.email,
    name: d.name,
    phone: d.phone,
    address: { name: d.name, line1: d.line1, city: d.city, postalCode: d.postalCode, country: d.country },
  });
  if (!changed) return jsonError("To zamówienie jest już opłacone albo nie istnieje.");
  after(() => fulfillOrder(d.orderId));
  return Response.json({ ok: true });
}
