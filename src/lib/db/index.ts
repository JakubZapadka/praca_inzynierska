import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Baza danych: SQLite (plik lokalny) lub Turso/libSQL w chmurze – ten sam kod.
 *   DATABASE_URL=file:./data/obrazio.db         (lokalnie / VPS)
 *   DATABASE_URL=libsql://twoja-baza.turso.io   (+ DATABASE_AUTH_TOKEN)
 */

const globalForDb = globalThis as unknown as { __obrazioDb?: LibSQLDatabase<typeof schema> & { $client: Client } };

function create() {
  const url = env.databaseUrl;
  if (url.startsWith("file:")) {
    mkdirSync(path.dirname(path.resolve(url.slice("file:".length))), { recursive: true });
  }
  const client = createClient({ url, authToken: env.databaseAuthToken });
  return drizzle(client, { schema });
}

export const db = globalForDb.__obrazioDb ?? (globalForDb.__obrazioDb = create());
export { schema };
