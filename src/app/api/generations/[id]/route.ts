import { getGenerationView } from "@/lib/generation-service";
import { jsonError } from "@/lib/request";

/** GET /api/generations/:id – stan generowania (front odpytuje co 2 s). */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const view = await getGenerationView(id);
  if (!view) return jsonError("Nie znaleziono generowania.", 404);
  return Response.json(view, { headers: { "Cache-Control": "no-store" } });
}
