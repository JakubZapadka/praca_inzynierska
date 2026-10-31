import { env } from "@/lib/env";
import { GelatoProvider } from "./gelato";
import { ManualProvider } from "./manual";
import type { FulfillmentProvider } from "./types";

const PROVIDERS: Record<string, FulfillmentProvider> = {
  gelato: new GelatoProvider(),
  manual: new ManualProvider(),
};

/** Drukarnia wybrana w .env (FULFILLMENT_PROVIDER=gelato | manual). */
export function getFulfillmentProvider(): FulfillmentProvider {
  return PROVIDERS[env.fulfillmentProvider] ?? PROVIDERS.manual;
}

export type { ShippingAddress } from "./types";
