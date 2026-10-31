import { env } from "@/lib/env";
import { setOrderStatus } from "@/lib/order-service";
import type { OrderStatus } from "@/lib/db/schema";

/**
 * POST /api/webhooks/gelato?token=GELATO_WEBHOOK_TOKEN
 * W panelu Gelato (Developer → Webhooks) dodaj ten adres dla zdarzenia "order_status_updated".
 */
const STATUS_MAP: Record<string, OrderStatus> = {
  in_production: "in_production",
  printed: "in_production",
  shipped: "shipped",
  delivered: "delivered",
  canceled: "cancelled",
  cancelled: "cancelled",
};

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!env.gelatoWebhookToken || token !== env.gelatoWebhookToken) {
    return new Response("Brak dostępu.", { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event: any = await request.json().catch(() => null);
  const orderId: string | undefined = event?.orderReferenceId;
  const status = STATUS_MAP[String(event?.fulfillmentStatus ?? "").toLowerCase()];
  if (orderId && status) {
    const trackingUrl: string | undefined = event?.items
      ?.flatMap((i: { fulfillments?: { trackingUrl?: string }[] }) => i.fulfillments ?? [])
      .find((f: { trackingUrl?: string }) => f.trackingUrl)?.trackingUrl;
    await setOrderStatus(orderId, status, { trackingUrl });
  }
  return Response.json({ ok: true });
}
