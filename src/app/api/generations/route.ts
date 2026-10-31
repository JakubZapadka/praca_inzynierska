import { after } from "next/server";
import { ORIENTATIONS, type Orientation } from "@/config/products";
import { SITE } from "@/config/site";
import { LimitError, createGeneration, runGeneration } from "@/lib/generation-service";
import { ACCEPTED_UPLOAD_TYPES, UploadError } from "@/lib/images";
import { clientIp, jsonError } from "@/lib/request";

// Generowanie trwa w tle po wysłaniu odpowiedzi – dajemy mu do 5 minut.
export const maxDuration = 300;

/** POST /api/generations – zdjęcie + opis -> start generowania wariantów. */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Niepoprawne dane formularza.");
  }

  const photo = form.get("photo");
  const prompt = String(form.get("prompt") ?? "").trim().slice(0, 600);
  const styleId = String(form.get("styleId") ?? "free");
  const orientation = String(form.get("orientation") ?? "portrait") as Orientation;

  if (form.get("rights") !== "on") {
    return jsonError("Potwierdź, że masz prawo do użycia tego zdjęcia.");
  }
  if (!(photo instanceof File) || photo.size === 0) {
    return jsonError("Dodaj zdjęcie.");
  }
  if (photo.size > SITE.maxUploadMb * 1024 * 1024) {
    return jsonError(`Zdjęcie może mieć najwyżej ${SITE.maxUploadMb} MB.`);
  }
  if (photo.type && !ACCEPTED_UPLOAD_TYPES.includes(photo.type)) {
    return jsonError("Prześlij zdjęcie JPG, PNG lub WEBP.");
  }
  if (!(orientation in ORIENTATIONS)) {
    return jsonError("Wybierz kształt obrazu.");
  }
  if (styleId === "free" && prompt.length < 3) {
    return jsonError("Opisz, jaki obraz chcesz dostać, albo wybierz styl.");
  }

  try {
    const { id, preset } = await createGeneration({
      photo: Buffer.from(await photo.arrayBuffer()),
      prompt,
      styleId,
      orientation,
      ip: clientIp(request),
    });
    after(() => runGeneration(id, preset));
    return Response.json({ id }, { status: 202 });
  } catch (error) {
    if (error instanceof LimitError) return jsonError(error.message, 429);
    if (error instanceof UploadError) return jsonError(error.message);
    console.error("[generations] start:", error);
    return jsonError("Nie udało się rozpocząć generowania. Spróbuj ponownie.", 500);
  }
}
