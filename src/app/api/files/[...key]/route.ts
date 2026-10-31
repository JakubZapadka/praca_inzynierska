import { storage } from "@/lib/storage";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * GET /api/files/<klucz> – serwuje pliki z magazynu.
 * Podglądy są publiczne, reszta wymaga podpisanego linku (?e=…&s=…).
 */
export async function GET(request: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await ctx.params;
  const key = parts.map(decodeURIComponent).join("/");
  const url = new URL(request.url);

  if (!storage.isPublic(key)) {
    const expires = Number(url.searchParams.get("e"));
    const signature = url.searchParams.get("s") ?? "";
    if (!storage.verify(key, expires, signature)) {
      return new Response("Link wygasł lub jest niepoprawny.", { status: 403 });
    }
  }

  try {
    const data = await storage.get(key);
    const ext = key.split(".").pop()?.toLowerCase() ?? "";
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": storage.isPublic(key) ? "public, max-age=31536000, immutable" : "private, no-store",
      },
    });
  } catch {
    return new Response("Nie znaleziono pliku.", { status: 404 });
  }
}
