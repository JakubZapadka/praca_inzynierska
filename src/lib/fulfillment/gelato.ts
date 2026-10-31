import { GELATO_PRODUCT_UIDS } from "@/config/gelato-products";
import { env } from "@/lib/env";
import type { FulfillmentProvider, FulfillmentRequest, FulfillmentResult } from "./types";

/**
 * Gelato – druk na żądanie z wysyłką do klienta.
 * Dokumentacja: https://developers.gelato.com (Order API v4)
 */
const ORDERS_URL = "https://order.gelatoapis.com/v4/orders";

export class GelatoProvider implements FulfillmentProvider {
  readonly id = "gelato";

  isConfigured() {
    return Boolean(env.gelatoApiKey);
  }

  async submit(req: FulfillmentRequest): Promise<FulfillmentResult> {
    if (!this.isConfigured()) {
      return { externalId: null, submitted: false, message: "Brak GELATO_API_KEY w .env." };
    }
    const productUid = GELATO_PRODUCT_UIDS[req.product.id]?.[req.orientation];
    if (!productUid) {
      return {
        externalId: null,
        submitted: false,
        message: `Brak productUid Gelato dla "${req.product.id}" (${req.orientation}). Uzupełnij src/config/gelato-products.ts.`,
      };
    }
    if (/localhost|127\.0\.0\.1/.test(req.printFileUrl)) {
      return {
        externalId: null,
        submitted: false,
        message: "Gelato nie pobierze pliku z localhost. Ustaw publiczny SITE_URL.",
      };
    }

    const [firstName, ...rest] = req.shippingAddress.name.trim().split(/\s+/);
    const body = {
      orderType: env.gelatoOrderType,
      orderReferenceId: req.orderId,
      customerReferenceId: req.customer.email,
      currency: env.gelatoCurrency,
      items: [
        {
          itemReferenceId: `${req.orderId}-1`,
          productUid,
          files: [{ type: "default", url: req.printFileUrl }],
          quantity: req.quantity,
        },
      ],
      ...(env.gelatoShipmentMethod ? { shipmentMethodUid: env.gelatoShipmentMethod } : {}),
      shippingAddress: {
        firstName: firstName || req.shippingAddress.name,
        lastName: rest.join(" ") || "-",
        addressLine1: req.shippingAddress.line1,
        addressLine2: req.shippingAddress.line2 ?? "",
        city: req.shippingAddress.city,
        postCode: req.shippingAddress.postalCode,
        state: req.shippingAddress.state ?? "",
        country: req.shippingAddress.country,
        email: req.customer.email,
        phone: req.customer.phone ?? "",
      },
    };

    const res = await fetch(ORDERS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": env.gelatoApiKey },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = json?.message ?? json?.error ?? `HTTP ${res.status}`;
      throw new Error(`Gelato odrzuciło zamówienie: ${typeof message === "string" ? message : JSON.stringify(message)}`);
    }
    return {
      externalId: json.id ?? null,
      submitted: true,
      message: env.gelatoOrderType === "draft" ? "Zapisane w Gelato jako szkic (GELATO_ORDER_TYPE=draft)." : undefined,
    };
  }
}
