"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { CUSTOM_OPENROUTER_PRESET_ID, findPreset } from "@/config/ai-models";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { fulfillOrder, setOrderStatus, updateOrder } from "@/lib/order-service";
import { SETTING_KEYS, setSetting } from "@/lib/settings";

async function assertAdmin() {
  if (!isAdminAuthorized((await headers()).get("authorization"))) {
    throw new Error("Brak dostępu.");
  }
}

/** Zmiana aktywnego modelu AI – działa od następnego generowania, bez redeployu. */
export async function saveModelSettings(formData: FormData) {
  await assertAdmin();
  const presetId = String(formData.get("presetId") ?? "");
  if (!findPreset(presetId)) throw new Error("Nieznany model.");
  await setSetting(SETTING_KEYS.activeModelPreset, presetId);

  const custom = String(formData.get("customModel") ?? "").trim();
  if (presetId === CUSTOM_OPENROUTER_PRESET_ID || custom) {
    await setSetting(SETTING_KEYS.customOpenRouterModel, custom);
  }
  refresh();
}

/** Ponowne przygotowanie pliku i wysłanie do drukarni (np. po uzupełnieniu productUid). */
export async function retryFulfillment(formData: FormData) {
  await assertAdmin();
  const orderId = String(formData.get("orderId"));
  await updateOrder(orderId, { error: null });
  after(() => fulfillOrder(orderId));
  refresh();
}

export async function markShipped(formData: FormData) {
  await assertAdmin();
  const orderId = String(formData.get("orderId"));
  const trackingUrl = String(formData.get("trackingUrl") ?? "").trim();
  await setOrderStatus(orderId, "shipped", { trackingUrl: trackingUrl || undefined });
  refresh();
}
