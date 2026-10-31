import { z } from "zod";
import { OrderError, startCheckout } from "@/lib/order-service";
import { jsonError } from "@/lib/request";

const Body = z.object({
  variantId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(10).default(1),
});

/** POST /api/checkout – tworzy zamówienie i zwraca adres płatności Stripe. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Wybierz obraz i produkt.");

  try {
    const { url } = await startCheckout(parsed.data);
    return Response.json({ url });
  } catch (error) {
    if (error instanceof OrderError) return jsonError(error.message);
    console.error("[checkout]", error);
    return jsonError("Nie udało się przejść do płatności. Spróbuj ponownie.", 500);
  }
}
