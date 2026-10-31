import type { Orientation, Product } from "@/config/products";

/**
 * Wspólny interfejs realizacji zamówień (drukarnia).
 * Tak samo jak przy AI: nowa drukarnia (Prodigi, Printful, własna) = nowy plik adaptera.
 */

export interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  postalCode: string;
  state?: string;
  country: string;
}

export interface FulfillmentRequest {
  orderId: string;
  product: Product;
  orientation: Orientation;
  quantity: number;
  /** Publiczny (podpisany) link do pliku do druku. */
  printFileUrl: string;
  customer: { email: string; phone?: string };
  shippingAddress: ShippingAddress;
}

export interface FulfillmentResult {
  externalId: string | null;
  /** Gdy false – zamówienie trafia do panelu jako "Wymaga uwagi". */
  submitted: boolean;
  message?: string;
}

export interface FulfillmentProvider {
  readonly id: string;
  isConfigured(): boolean;
  submit(req: FulfillmentRequest): Promise<FulfillmentResult>;
}
