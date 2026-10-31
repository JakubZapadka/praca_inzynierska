/**
 * Testy adapterów AI bez prawdziwych zapytań (fetch jest podmieniony).
 * Uruchom: npm test
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

process.env.OPENROUTER_API_KEY = "test-or-key";
process.env.GEMINI_API_KEY = "test-gemini-key";

const { OpenRouterProvider } = await import("../src/lib/ai/providers/openrouter");
const { GeminiProvider } = await import("../src/lib/ai/providers/gemini");
const { findPreset } = await import("../src/config/ai-models");
const { buildPrompt } = await import("../src/config/prompts");
type Req = import("../src/lib/ai/types").ImageGenerationRequest;

const PNG = Buffer.from("fake-png-bytes");
const realFetch = globalThis.fetch;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Call = { url: string; init: RequestInit; body: any };

function mockFetch(responses: Array<{ status?: number; json: unknown }>) {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init, body: JSON.parse(String(init.body)) });
    const next = responses.shift();
    if (!next) throw new Error("Nieoczekiwane zapytanie");
    return new Response(JSON.stringify(next.json), { status: next.status ?? 200 });
  }) as typeof fetch;
  return calls;
}

const request = (count = 1): Req => ({
  prompt: buildPrompt({ userPrompt: "nasz pies", styleId: "watercolor", variantIndex: 0 }),
  referenceImages: [{ data: Buffer.from("photo"), mimeType: "image/jpeg" }],
  aspectRatio: "3:4",
  resolution: "2K",
  count,
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("OpenRouter", () => {
  const preset = findPreset("nano-banana-2.1-openrouter")!;

  it("wysyła zdjęcie i prompt do chat/completions i odczytuje obraz", async () => {
    const calls = mockFetch([
      {
        json: {
          choices: [{ message: { content: "", images: [{ image_url: { url: `data:image/png;base64,${PNG.toString("base64")}` } }] } }],
          usage: { cost: 0.04 },
        },
      },
    ]);
    const [img] = await new OpenRouterProvider().generate(request(), preset);
    assert.equal(calls[0].url, "https://openrouter.ai/api/v1/chat/completions");
    assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer test-or-key");
    assert.equal(calls[0].body.model, "google/gemini-nano-banana-2.1");
    assert.deepEqual(calls[0].body.modalities, ["image", "text"]);
    assert.deepEqual(calls[0].body.image_config, { aspect_ratio: "3:4", image_size: "2K" });
    assert.match(calls[0].body.messages[0].content[1].image_url.url, /^data:image\/jpeg;base64,/);
    assert.ok(img.data.equals(PNG));
    assert.equal(img.costUsd, 0.04);
  });

  it("gdy endpoint images odrzuci model, próbuje chat", async () => {
    const calls = mockFetch([
      { status: 400, json: { error: { message: "model not supported", code: 400 } } },
      { json: { choices: [{ message: { images: [{ image_url: { url: `data:image/png;base64,${PNG.toString("base64")}` } }] } }] } },
    ]);
    const custom = { ...preset, options: { endpoint: "images" } };
    const [img] = await new OpenRouterProvider().generate(request(), custom);
    assert.equal(calls[0].url, "https://openrouter.ai/api/v1/images");
    assert.equal(calls[0].body.input_references[0].type, "image_url");
    assert.equal(calls[0].body.n, undefined, "n wysyłamy tylko dla count > 1");
    assert.equal(calls[1].url, "https://openrouter.ai/api/v1/chat/completions");
    assert.ok(img.data.equals(PNG));
  });

  it("endpoint images zwraca kilka obrazów naraz (n)", async () => {
    const calls = mockFetch([
      { json: { data: [1, 2, 3, 4].map(() => ({ b64_json: PNG.toString("base64"), media_type: "image/png" })), usage: { cost: 0.2 } } },
    ]);
    const imgs = await new OpenRouterProvider().generate(request(4), { ...preset, options: { endpoint: "images" } });
    assert.equal(calls[0].body.n, 4);
    assert.equal(imgs.length, 4);
    assert.equal(imgs[0].costUsd, 0.05);
  });

  it("zgłasza czytelny błąd, gdy model nie zwróci obrazu", async () => {
    mockFetch([{ json: { choices: [{ message: { content: "I can't help with that." } }] } }]);
    await assert.rejects(new OpenRouterProvider().generate(request(), preset), /nie zwrócił obrazu: I can't help/);
  });
});

describe("Google Gemini", () => {
  const preset = findPreset("nano-banana-2.1-google")!;

  it("używa Interactions API i bierze końcowy obraz z model_output", async () => {
    const calls = mockFetch([
      {
        json: {
          steps: [
            { type: "thought", summary: [{ type: "image", data: "dGhvdWdodA==" }] },
            { type: "model_output", content: [{ type: "text", text: "Gotowe" }, { type: "image", data: PNG.toString("base64"), mime_type: "image/png" }] },
          ],
        },
      },
    ]);
    const [img] = await new GeminiProvider().generate(request(), preset);
    assert.equal(calls[0].url, "https://generativelanguage.googleapis.com/v1beta/interactions");
    assert.equal((calls[0].init.headers as Record<string, string>)["x-goog-api-key"], "test-gemini-key");
    assert.equal(calls[0].body.model, "gemini-nano-banana-2.1");
    assert.equal(calls[0].body.input[1].type, "image");
    assert.equal(calls[0].body.input[1].mime_type, "image/jpeg");
    assert.equal(calls[0].body.response_format.aspect_ratio, "3:4");
    assert.equal(calls[0].body.response_format.image_size, "2K");
    assert.equal(calls[0].body.generation_config.thinking_level, "medium");
    assert.ok(img.data.equals(PNG));
  });

  it("przekazuje komunikat błędu z API", async () => {
    mockFetch([{ status: 403, json: { error: { message: "API key not valid" } } }]);
    await assert.rejects(new GeminiProvider().generate(request(), preset), /Gemini: API key not valid/);
  });
});
