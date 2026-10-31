import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/AutoRefresh";
import { FramedImage } from "@/components/FramedImage";
import { ORDER_STATUS_LABELS } from "@/config/order-status";
import { FRAMES, dimensionsCm } from "@/config/products";
import { formatPrice } from "@/config/site";
import { getOrderView } from "@/lib/order-service";

export default function OrderPage({ params }: PageProps<"/zamowienie/[id]">) {
  return (
    <section className="mx-auto max-w-6xl px-5 pt-10 sm:px-8">
      <Suspense fallback={<p className="text-ink-soft">Wczytuję zamówienie…</p>}>
        <OrderDetails params={params} />
      </Suspense>
    </section>
  );
}

async function OrderDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await getOrderView(id);
  if (!view) notFound();
  const { order, product, title, previewUrl } = view;
  const waiting = order.status === "pending_payment" || order.status === "paid";
  const dims = product ? dimensionsCm(product, order.orientation) : { width: 3, height: 4 };

  return (
    <div className="grid gap-12 lg:grid-cols-2">
      {waiting ? <AutoRefresh /> : null}
      <div>
        <h1 className="font-display text-5xl leading-tight tracking-tight">
          {order.status === "pending_payment" ? "Prawie gotowe" : "Dziękujemy za zamówienie"}
        </h1>
        <p className="mt-4 text-lg" aria-live="polite">
          {ORDER_STATUS_LABELS[order.status].customer}
        </p>
        {order.trackingUrl ? (
          <p className="mt-3">
            <a href={order.trackingUrl} className="font-semibold text-cobalt underline underline-offset-4">
              Śledź przesyłkę
            </a>
          </p>
        ) : null}

        <dl className="mt-8 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t border-ink/15 pt-6 text-sm">
          <dt className="text-ink-soft">Numer zamówienia</dt>
          <dd className="font-semibold break-all">{order.id.slice(0, 8).toUpperCase()}</dd>
          <dt className="text-ink-soft">Produkt</dt>
          <dd>
            {title}
            {order.quantity > 1 ? ` × ${order.quantity}` : ""}
          </dd>
          {order.amountTotal ? (
            <>
              <dt className="text-ink-soft">Zapłacono</dt>
              <dd>{formatPrice(order.amountTotal)}</dd>
            </>
          ) : null}
          {order.customerEmail ? (
            <>
              <dt className="text-ink-soft">Potwierdzenia wyślemy na</dt>
              <dd>{order.customerEmail}</dd>
            </>
          ) : null}
        </dl>
        <p className="mt-8 text-sm text-ink-soft">
          Zapisz ten adres strony – tu zawsze sprawdzisz stan zamówienia.
        </p>
        <Link href="/" className="mt-6 inline-block font-semibold text-cobalt underline underline-offset-4">
          Stwórz kolejny obraz
        </Link>
      </div>
      <div className="flex items-center justify-center py-6">
        <FramedImage
          src={previewUrl}
          aspect={`${dims.width} / ${dims.height}`}
          kind={product?.kind ?? "framed"}
          frameColor={product?.frame ? FRAMES[product.frame].color : undefined}
          className="w-3/4 max-w-md"
          alt="Zamówiony obraz"
        />
      </div>
    </div>
  );
}
