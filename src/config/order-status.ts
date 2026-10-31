import type { OrderStatus } from "@/lib/db/schema";

/** Opisy statusów widoczne dla klienta i w panelu admina. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, { customer: string; admin: string }> = {
  pending_payment: { customer: "Czekamy na potwierdzenie płatności", admin: "Czeka na płatność" },
  paid: { customer: "Opłacone – przygotowujemy plik do druku", admin: "Opłacone" },
  submitted: { customer: "Przekazane do drukarni", admin: "W drukarni" },
  in_production: { customer: "Obraz jest drukowany", admin: "W produkcji" },
  shipped: { customer: "Wysłane", admin: "Wysłane" },
  delivered: { customer: "Doręczone", admin: "Doręczone" },
  needs_attention: { customer: "Opłacone – przygotowujemy Twój obraz", admin: "Wymaga uwagi" },
  cancelled: { customer: "Anulowane", admin: "Anulowane" },
};
