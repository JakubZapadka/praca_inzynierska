import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Panel admina chroni proste logowanie HTTP Basic (ADMIN_USER / ADMIN_PASSWORD).
 * Bez ustawionego hasła panel działa tylko lokalnie (npm run dev).
 */
export function isAdminAuthorized(authorization: string | null): boolean {
  if (!env.adminPassword) return process.env.NODE_ENV !== "production";
  if (!authorization?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
  const expected = `${env.adminUser}:${env.adminPassword}`;
  const a = Buffer.from(decoded);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
