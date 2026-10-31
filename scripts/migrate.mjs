/**
 * Tworzy / aktualizuje tabele w bazie danych.
 * Uruchamiane automatycznie przed `npm run dev` i `npm run start`.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdirSync } from "node:fs";
import path from "node:path";

try {
  process.loadEnvFile(".env");
} catch {
  // brak pliku .env – używamy zmiennych systemowych
}

const url = process.env.DATABASE_URL || "file:./data/obrazio.db";
if (url.startsWith("file:")) {
  mkdirSync(path.dirname(path.resolve(url.slice("file:".length))), { recursive: true });
}

const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
client.close();
console.log(`✓ Baza danych gotowa (${url.startsWith("file:") ? url : "zdalna libSQL"})`);
