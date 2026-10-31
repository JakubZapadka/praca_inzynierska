import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DevCheckoutForm } from "@/components/DevCheckoutForm";
import { env } from "@/lib/env";
import { getOrderView } from "@/lib/order-service";
import { formatPrice } from "@/config/site";

/** Testowa strona płatności – działa tylko bez klucza Stripe i poza produkcją. */
export default function TestPaymentPage({ params }: PageProps<"/zamowienie/[id]/test-platnosci">) {
  return (
    <section className="mx-auto max-w-xl px-5 pt-10 sm:px-8">
      <Suspense fallback={<p className="text-ink-soft">Wczytuję…</p>}>
        <TestPayment params={params} />
      </Suspense>
    </section>
  );
}

async function TestPayment({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await getOrderView(id);
  if (!view || !env.allowDevCheckout) notFound();
  const total = view.order.itemPrice * view.order.quantity + view.order.shippingPrice;

  return (
    <>
      <p className="border-l-4 border-oak bg-mat px-3 py-2 text-sm">
        Testowa płatność. Stripe nie jest jeszcze podłączony, więc nic nie zostanie pobrane. Po dodaniu
        STRIPE_SECRET_KEY klient trafi tu na prawdziwą stronę płatności.
      </p>
      <h1 className="mt-6 font-display text-4xl tracking-tight">Adres dostawy</h1>
      <p className="mt-2 text-ink-soft">
        {view.title} – razem z dostawą {formatPrice(total)}
      </p>
      <DevCheckoutForm orderId={id} />
    </>
  );
}
