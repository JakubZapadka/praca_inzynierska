import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL || "file:./data/obrazio.db";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: url.startsWith("file:") ? "sqlite" : "turso",
  dbCredentials: { url, authToken: process.env.DATABASE_AUTH_TOKEN },
});
