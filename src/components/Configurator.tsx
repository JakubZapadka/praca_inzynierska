"use client";

import { useMemo, useState } from "react";
import {
  FRAMES,
  KINDS,
  dimensionsCm,
  productTitle,
  productsFor,
  type FrameColor,
  type Orientation,
  type ProductKind,
} from "@/config/products";
import { SITE, formatPrice } from "@/config/site";
import type { VariantView } from "./Creator";
import { FramedImage } from "./FramedImage";

interface Props {
  variant: VariantView;
  variants: VariantView[];
  orientation: Orientation;
  onSelectVariant: (v: VariantView) => void;
  onBack: () => void;
}

export function Configurator({ variant, variants, orientation, onSelectVariant, onBack }: Props) {
  const available = useMemo(() => productsFor(orientation), [orientation]);
  const sizes = useMemo(() => [...new Map(available.map((p) => [p.size.id, p.size])).values()], [available]);

  const [kind, setKind] = useState<ProductKind>("framed");
  const [sizeId, setSizeId] = useState(sizes[0]?.id ?? "");
  const [frame, setFrame] = useState<FrameColor>("black");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const product =
    available.find(
      (p) => p.kind === kind && p.size.id === sizeId && (kind !== "framed" || p.frame === frame),
    ) ?? available[0];
  const dims = dimensionsCm(product, orientation);
  const total = product.price * quantity + SITE.shippingPrice;
  const largest = Math.max(...sizes.map((s) => s.longCm));
  const previewWidth = `${Math.round(48 + 50 * (product.size.longCm / largest))}%`;

  async function checkout() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: variant.id, productId: product.id, quantity }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Nie udało się przejść do płatności.");
      window.location.href = json.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się przejść do płatności.");
      setPending(false);
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-14">
      <div className="flex flex-col gap-7">
        <button type="button" onClick={onBack} className="self-start text-sm underline underline-offset-4">
          Wróć do wszystkich propozycji
        </button>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Wykonanie</legend>
          <div className="flex flex-col gap-2">
            {(Object.keys(KINDS) as ProductKind[]).map((k) => (
              <label
                key={k}
                className={`flex cursor-pointer flex-col border-2 bg-mat/70 px-4 py-3 transition-colors has-focus-visible:outline-3 has-focus-visible:outline-cobalt ${
                  kind === k ? "border-cobalt" : "border-transparent hover:border-ink/25"
                }`}
              >
                <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
                <span className="flex items-baseline justify-between gap-3 font-semibold">
                  {KINDS[k].label}
                  <span className="text-sm font-normal text-ink-soft">
                    od {formatPrice(Math.min(...available.filter((p) => p.kind === k).map((p) => p.price)))}
                  </span>
                </span>
                <span className="text-sm text-ink-soft">{KINDS[k].description}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Rozmiar</legend>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => {
              const p = available.find((x) => x.kind === kind && x.size.id === s.id);
              const d = orientation === "landscape" ? `${s.longCm}×${s.shortCm}` : `${s.shortCm}×${s.longCm}`;
              return (
                <label
                  key={s.id}
                  className={`flex cursor-pointer flex-col border-2 bg-mat/70 px-4 py-2 text-sm transition-colors has-focus-visible:outline-3 has-focus-visible:outline-cobalt ${
                    sizeId === s.id ? "border-cobalt" : "border-transparent hover:border-ink/25"
                  }`}
                >
                  <input type="radio" name="size" checked={sizeId === s.id} onChange={() => setSizeId(s.id)} className="sr-only" />
                  <span className="font-semibold">{d} cm</span>
                  {p ? <span className="text-ink-soft">{formatPrice(p.price)}</span> : null}
                </label>
              );
            })}
          </div>
        </fieldset>

        {kind === "framed" ? (
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Rama: {FRAMES[frame].label.toLowerCase()}</legend>
            <div className="flex gap-3">
              {(Object.keys(FRAMES) as FrameColor[]).map((f) => (
                <label key={f} className="cursor-pointer has-focus-visible:outline-3 has-focus-visible:outline-cobalt">
                  <input type="radio" name="frame" checked={frame === f} onChange={() => setFrame(f)} className="sr-only" />
                  <span className="sr-only">{FRAMES[f].label}</span>
                  <span
                    aria-hidden
                    className={`block size-11 border-[7px] bg-mat ring-offset-2 ring-offset-wall ${
                      frame === f ? "ring-2 ring-cobalt" : "ring-1 ring-ink/15"
                    }`}
                    style={{ borderColor: FRAMES[f].color }}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-semibold">Liczba sztuk</span>
          <div className="flex items-center border-2 border-ink/15 bg-mat/70">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="px-3 py-1.5 text-lg"
              aria-label="Mniej sztuk"
            >
              −
            </button>
            <span className="w-8 text-center tabular-nums" aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(10, q + 1))}
              className="px-3 py-1.5 text-lg"
              aria-label="Więcej sztuk"
            >
              +
            </button>
          </div>
        </div>

        <div className="border-t border-ink/15 pt-5">
          <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
            <dt className="text-ink-soft">{productTitle(product, orientation)}{quantity > 1 ? ` × ${quantity}` : ""}</dt>
            <dd className="text-right">{formatPrice(product.price * quantity)}</dd>
            <dt className="text-ink-soft">Dostawa: {SITE.shippingLabel.toLowerCase()}</dt>
            <dd className="text-right">{formatPrice(SITE.shippingPrice)}</dd>
            <dt className="mt-2 text-base font-semibold">Razem</dt>
            <dd className="mt-2 text-right text-base font-semibold">{formatPrice(total)}</dd>
          </dl>
        </div>

        {error ? (
          <p role="alert" className="border-l-4 border-alert bg-mat px-3 py-2 text-sm text-alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={checkout}
          disabled={pending}
          className="bg-cobalt px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-cobalt-deep disabled:opacity-60"
        >
          {pending ? "Przechodzę do płatności…" : `Zamawiam za ${formatPrice(total)}`}
        </button>
        <p className="-mt-3 text-sm text-ink-soft">
          Adres dostawy podasz na stronie płatności. Płatność obsługuje Stripe.
        </p>
      </div>

      <section aria-label="Podgląd na ścianie" className="flex min-w-0 flex-col items-center">
        <div className="flex w-full max-w-xl flex-1 flex-col items-center justify-center py-6">
          <FramedImage
            src={variant.previewUrl}
            aspect={`${dims.width} / ${dims.height}`}
            kind={kind}
            frameColor={kind === "framed" ? FRAMES[frame].color : undefined}
            style={{ width: previewWidth }}
            alt="Wybrana propozycja"
          />
          <p className="mt-5 bg-mat px-3 py-1.5 text-sm shadow-sm">
            <span className="font-semibold">{dims.width} × {dims.height} cm</span>
            <span className="ml-2 text-ink-soft">{KINDS[kind].label.toLowerCase()}</span>
          </p>
        </div>

        {variants.length > 1 ? (
          <div className="mt-6 flex gap-3" role="radiogroup" aria-label="Zmień propozycję">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={v.id === variant.id}
                aria-label={`Propozycja ${v.position + 1}`}
                onClick={() => onSelectVariant(v)}
                className={`w-16 border-4 bg-mat p-0.5 transition-transform hover:-translate-y-0.5 ${
                  v.id === variant.id ? "border-cobalt" : "border-mat"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.previewUrl ?? ""} alt="" className="block aspect-square w-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
