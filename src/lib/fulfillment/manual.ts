import type { FulfillmentProvider, FulfillmentResult } from "./types";

/**
 * Realizacja ręczna: zamówienie zostaje w panelu admina z gotowym plikiem do druku.
 * Przydatne na start, do testów i gdy drukujesz u lokalnej drukarni.
 */
export class ManualProvider implements FulfillmentProvider {
  readonly id = "manual";

  isConfigured() {
    return true;
  }

  async submit(): Promise<FulfillmentResult> {
    return {
      externalId: null,
      submitted: false,
      message: "Realizacja ręczna: pobierz plik do druku z panelu i oznacz zamówienie jako wysłane.",
    };
  }
}
