import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

/**
 * Przechowywanie plików (zdjęcia klientów, wygenerowane obrazy, pliki do druku).
 *
 * Domyślnie: dysk serwera (STORAGE_DIR). Wystarcza na VPS / Railway / Fly z wolumenem.
 * Na Vercelu dysk jest tymczasowy – tam podmień implementację na S3 / Cloudflare R2
 * (ten sam interfejs: put / get / url).
 *
 * Klucze:
 *   uploads/<generacja>.jpg      – zdjęcie klienta (prywatne)
 *   originals/<generacja>/<n>.*  – pełna rozdzielczość z AI (prywatne)
 *   previews/<generacja>/<n>.webp – podgląd ze znakiem wodnym (publiczny)
 *   print/<zamówienie>.jpg        – plik do drukarni (prywatny, link podpisany)
 */

const PUBLIC_PREFIXES = ["previews/"];

function resolveKey(key: string): string {
  const root = path.resolve(env.storageDir);
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("Niepoprawny klucz pliku.");
  return full;
}

export const storage = {
  async put(key: string, data: Buffer): Promise<void> {
    const full = resolveKey(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
  },

  async get(key: string): Promise<Buffer> {
    return readFile(resolveKey(key));
  },

  isPublic(key: string): boolean {
    return PUBLIC_PREFIXES.some((p) => key.startsWith(p));
  },

  /** Adres pliku. Prywatne pliki dostają podpisany link ważny `ttlSeconds`. */
  url(key: string, opts: { absolute?: boolean; ttlSeconds?: number } = {}): string {
    const base = `${opts.absolute ? env.siteUrl : ""}/api/files/${key}`;
    if (this.isPublic(key)) return base;
    const expires = Math.floor(Date.now() / 1000) + (opts.ttlSeconds ?? 3600);
    return `${base}?e=${expires}&s=${sign(key, expires)}`;
  },

  verify(key: string, expires: number, signature: string): boolean {
    if (!Number.isFinite(expires) || expires < Date.now() / 1000) return false;
    const expected = Buffer.from(sign(key, expires));
    const given = Buffer.from(signature);
    return expected.length === given.length && timingSafeEqual(expected, given);
  },
};

function sign(key: string, expires: number): string {
  return createHmac("sha256", env.appSecret).update(`${key}:${expires}`).digest("base64url");
}
