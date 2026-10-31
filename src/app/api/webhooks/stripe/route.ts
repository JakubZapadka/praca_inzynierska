import { after } from "next/server";
import type Stripe from "stripe";
import { env } from "@/lib/env";
import { fulfillOrder, markOrderPaid } from "@/lib/order-service";
import { getStripe } from "@/lib/payments/stripe";

export const maxDuration = 120;

/**
 * POST /api/webhooks/stripe
 * W panelu Stripe dodaj endpoint https://twoja-domena/api/webhooks/stripe ze zdarzeniami:
 *   checkout.session.completed, checkout.session.async_payment_succeeded
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature || !env.stripeWebhookSecret) {
    return new Response("Brak podpisu lub STRIPE_WEBHOOK_SECRET.", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, env.stripeWebhookSecret);
  } catch (error) {
    console.error("[stripe webhook] zły podpis:", error);
    return new Response("Niepoprawny podpis.", { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId ?? session.client_reference_id;
    // BLIK i karta są opłacone od razu; niektóre metody potwierdzają płatność później (async_payment_succeeded).
    if (orderId && session.payment_status === "paid") {
      const shipping = session.collected_information?.shipping_details;
      const address = shipping?.address;
      const changed = await markOrderPaid(orderId, {
        email: session.customer_details?.email ?? "",
        name: shipping?.name ?? session.customer_details?.name ?? "",
        phone: session.customer_details?.phone ?? undefined,
        amountTotal: session.amount_total ?? undefined,
        address: {
          name: shipping?.name ?? session.customer_details?.name ?? "",
          line1: address?.line1 ?? "",
          line2: address?.line2 ?? undefined,
          city: address?.city ?? "",
          postalCode: address?.postal_code ?? "",
          state: address?.state ?? undefined,
          country: address?.country ?? "",
        },
      });
      if (changed) after(() => fulfillOrder(orderId));
    }
  }

  return Response.json({ received: true });
}
