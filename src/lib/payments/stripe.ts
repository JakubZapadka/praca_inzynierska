import Stripe from "stripe";
import { env } from "@/lib/env";

let client: Stripe | null = null;

export function isStripeConfigured() {
  return Boolean(env.stripeSecretKey);
}

export function getStripe(): Stripe {
  if (!env.stripeSecretKey) throw new Error("Brak STRIPE_SECRET_KEY w .env");
  client ??= new Stripe(env.stripeSecretKey);
  return client;
}
