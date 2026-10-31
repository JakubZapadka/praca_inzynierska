import { connection } from "next/server";
import { Suspense } from "react";
import { MODEL_PRESETS, CUSTOM_OPENROUTER_PRESET_ID } from "@/config/ai-models";
import { ORDER_STATUS_LABELS } from "@/config/order-status";
import { findProduct, productTitle } from "@/config/products";
import { formatPrice } from "@/config/site";
import { getActivePreset, providerStatus } from "@/lib/ai";
import { env } from "@/lib/env";
import { getFulfillmentProvider } from "@/lib/fulfillment";
import { getGenerationStats } from "@/lib/generation-service";
import { listOrders } from "@/lib/order-service";
import { isStripeConfigured } from "@/lib/payments/stripe";
import { SETTING_KEYS, getSetting } from "@/lib/settings";
import { storage } from "@/lib/storage";
import { markShipped, retryFulfillment, saveModelSettings } from "./actions";

const KEY_NAMES: Record<string, string> = {
  openrouter: "OPENROUTER_API_KEY",
  gemini: "GEMINI_API_KEY",
  mock: "",
};

export const metadata = { title: "Panel sklepu", robots: { index: false, follow: false } };

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 pt-6 sm:px-8">
      <h1 className="font-display text-5xl tracking-tight">Panel sklepu</h1>
      <Suspense fallback={<p className="mt-8 text-ink-soft">Wczytuję…</p>}>
        <AdminContent />
      </Suspense>
    </div>
  );
}

/** Panel zawsze pokazuje aktualne dane – renderowany przy każdym wejściu. */
async function AdminContent() {
  await connection();
  return (
    <>
      <ModelSection />
      <SetupSection />
      <OrdersSection />
      <GenerationsSection />
    </>
  );
}

function Section({ title, children, intro }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="mt-14">
      <h2 className="font-display text-3xl tracking-tight">{title}</h2>
      {intro ? <p className="mt-2 max-w-2xl text-ink-soft">{intro}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

async function ModelSection() {
  const active = await getActivePreset();
  const custom = (await getSetting(SETTING_KEYS.customOpenRouterModel)) ?? "";
  const configured = Object.fromEntries(providerStatus().map((p) => [p.id, p.configured]));

  return (
    <Section
      title="Model AI"
      intro="Zmiana działa od następnego generowania. Nowe modele dopisujesz w src/config/ai-models.ts."
    >
      <form action={saveModelSettings} className="grid gap-3">
        {MODEL_PRESETS.map((preset) => (
          <label
            key={preset.id}
            className="flex cursor-pointer gap-4 border-2 border-transparent bg-mat/70 p-4 has-checked:border-cobalt"
          >
            <input
              type="radio"
              name="presetId"
              value={preset.id}
              defaultChecked={preset.id === active.id}
              className="mt-1 accent-cobalt"
            />
            <span className="grid gap-1">
              <span className="font-semibold">{preset.label}</span>
              <span className="text-sm text-ink-soft">
                {preset.model ? <code className="mr-2">{preset.model}</code> : null}
                {preset.note}
              </span>
              <span className={`text-sm ${configured[preset.provider] ? "text-ink-soft" : "text-alert"}`}>
                {preset.provider === "mock"
                  ? "Nie wymaga klucza"
                  : configured[preset.provider]
                    ? `Klucz ${KEY_NAMES[preset.provider]} ustawiony`
                    : `Brak ${KEY_NAMES[preset.provider]} w .env`}
              </span>
              {preset.id === CUSTOM_OPENROUTER_PRESET_ID ? (
                <input
                  name="customModel"
                  defaultValue={custom}
                  placeholder="np. bytedance-seed/seedream-4.5"
                  className="mt-2 max-w-md border-2 border-ink/15 bg-mat p-2 text-sm focus:border-cobalt focus:outline-none"
                />
              ) : null}
            </span>
          </label>
        ))}
        <button
          type="submit"
          className="mt-2 justify-self-start bg-cobalt px-5 py-3 font-semibold text-white hover:bg-cobalt-deep"
        >
          Zapisz wybór modelu
        </button>
      </form>
    </Section>
  );
}

async function SetupSection() {
  const fulfillment = getFulfillmentProvider();
  const checks = [
    { label: "Adres sklepu (SITE_URL)", ok: !env.siteUrl.includes("localhost"), value: env.siteUrl },
    { label: "Płatności Stripe", ok: isStripeConfigured(), value: isStripeConfigured() ? "podłączone" : "tryb testowy" },
    { label: "Webhook Stripe", ok: Boolean(env.stripeWebhookSecret), value: env.stripeWebhookSecret ? "ustawiony" : "brak" },
    {
      label: "Drukarnia",
      ok: fulfillment.id !== "manual" && fulfillment.isConfigured(),
      value:
        fulfillment.id === "gelato"
          ? `Gelato (${env.gelatoOrderType === "draft" ? "tylko szkice" : "prawdziwe zamówienia"})`
          : "realizacja ręczna",
    },
    { label: "Hasło panelu", ok: Boolean(env.adminPassword), value: env.adminPassword ? "ustawione" : "brak" },
  ];
  return (
    <Section title="Konfiguracja">
      <ul className="grid gap-2 sm:grid-cols-2">
        {checks.map((c) => (
          <li key={c.label} className="flex items-baseline justify-between gap-4 bg-mat/70 px-4 py-3 text-sm">
            <span className="font-semibold">{c.label}</span>
            <span className={c.ok ? "text-ink-soft" : "text-alert"}>{c.value}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

async function OrdersSection() {
  const orders = await listOrders(50);
  return (
    <Section title="Zamówienia">
      {orders.length === 0 ? (
        <p className="text-ink-soft">Nie ma jeszcze zamówień. Złóż testowe na stronie głównej.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-ink">
                <th className="py-2 pr-3">Data</th>
                <th className="py-2 pr-3">Zamówienie</th>
                <th className="py-2 pr-3">Klient</th>
                <th className="py-2 pr-3">Kwota</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Działania</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const product = findProduct(o.productId);
                const address = o.shippingAddress ? JSON.parse(o.shippingAddress) : null;
                return (
                  <tr key={o.id} className="border-b border-ink/10 align-top">
                    <td className="py-3 pr-3 whitespace-nowrap">{o.createdAt.toLocaleString("pl-PL")}</td>
                    <td className="py-3 pr-3">
                      <a href={`/zamowienie/${o.id}`} className="font-semibold underline underline-offset-2">
                        {o.id.slice(0, 8).toUpperCase()}
                      </a>
                      <div>{product ? productTitle(product, o.orientation) : o.productId}</div>
                      {o.quantity > 1 ? <div>× {o.quantity}</div> : null}
                    </td>
                    <td className="py-3 pr-3">
                      {o.customerName ?? "–"}
                      {o.customerEmail ? <div className="text-ink-soft">{o.customerEmail}</div> : null}
                      {address ? (
                        <div className="text-ink-soft">
                          {address.line1}, {address.postalCode} {address.city}, {address.country}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap">
                      {formatPrice(o.amountTotal ?? o.itemPrice * o.quantity + o.shippingPrice)}
                    </td>
                    <td className="py-3 pr-3">
                      <span className={o.status === "needs_attention" ? "font-semibold text-alert" : ""}>
                        {ORDER_STATUS_LABELS[o.status].admin}
                      </span>
                      {o.error ? <div className="mt-1 max-w-xs text-ink-soft">{o.error}</div> : null}
                      {o.fulfillmentOrderId ? (
                        <div className="mt-1 text-ink-soft">Drukarnia: {o.fulfillmentOrderId}</div>
                      ) : null}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-col items-start gap-2">
                        {o.printFileKey ? (
                          <a
                            href={storage.url(o.printFileKey, { ttlSeconds: 3600 })}
                            className="text-cobalt underline underline-offset-2"
                          >
                            Pobierz plik do druku
                          </a>
                        ) : null}
                        {o.status === "needs_attention" || o.status === "paid" ? (
                          <form action={retryFulfillment}>
                            <input type="hidden" name="orderId" value={o.id} />
                            <button className="text-cobalt underline underline-offset-2">Wyślij do drukarni ponownie</button>
                          </form>
                        ) : null}
                        {["needs_attention", "submitted", "in_production", "paid"].includes(o.status) ? (
                          <form action={markShipped} className="flex gap-1">
                            <input type="hidden" name="orderId" value={o.id} />
                            <input
                              name="trackingUrl"
                              placeholder="Link do śledzenia"
                              className="w-36 border border-ink/20 bg-mat px-2 py-1"
                            />
                            <button className="bg-ink px-2 py-1 text-white">Wysłane</button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

async function GenerationsSection() {
  const { count, cost, recent } = await getGenerationStats(30, 12);

  return (
    <Section
      title="Ostatnie generowania"
      intro={`Ostatnie 30 dni: ${count} generowań, szacowany koszt AI ${cost.toFixed(2)} USD.`}
    >
      {recent.length === 0 ? (
        <p className="text-ink-soft">Jeszcze nikt nic nie namalował.</p>
      ) : (
        <ul className="grid gap-4">
          {recent.map((g) => {
            const vs = g.variants;
            return (
              <li key={g.id} className="grid gap-4 bg-mat/70 p-4 sm:grid-cols-[auto_1fr]">
                <div className="flex gap-2">
                  {vs.map((v) =>
                    v.previewKey ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={v.id} src={storage.url(v.previewKey)} alt="" className="size-16 object-cover" />
                    ) : (
                      <span key={v.id} className="grid size-16 place-items-center bg-wall-deep text-xs text-ink-soft">
                        {v.status === "failed" ? "błąd" : "…"}
                      </span>
                    ),
                  )}
                </div>
                <div className="text-sm">
                  <div className="font-semibold">
                    {g.createdAt.toLocaleString("pl-PL")} – {g.modelName}
                  </div>
                  <div className="text-ink-soft">
                    Styl: {g.styleId}, {g.aspectRatio}
                    {g.costUsd != null ? `, ${g.costUsd.toFixed(3)} USD` : ""}
                  </div>
                  <div className="text-ink-soft">IP: {g.ip ?? "brak (wpis sprzed zapisywania IP)"}</div>
                  {g.prompt ? <div className="mt-1">„{g.prompt}”</div> : null}
                  {vs.find((v) => v.error) ? (
                    <div className="mt-1 text-alert">{vs.find((v) => v.error)?.error}</div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
