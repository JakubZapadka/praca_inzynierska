"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ORIENTATIONS, type Orientation } from "@/config/products";
import { STYLES } from "@/config/prompts";
import { SITE } from "@/config/site";
import { Configurator } from "./Configurator";
import { FramedImage } from "./FramedImage";

export interface VariantView {
  id: string;
  position: number;
  status: "pending" | "done" | "failed";
  previewUrl: string | null;
}

interface GenerationView {
  id: string;
  status: "running" | "done" | "failed";
  aspectRatio: string;
  /** Start generowania (ms) – do licznika czasu na ścianie. */
  createdAt: number;
  error: string | null;
  variants: VariantView[];
}

/** Tyle zwykle trwa malowanie. Po tym czasie mówimy klientowi, że trwa to dłużej, ale pracujemy. */
const EXPECTED_SECONDS = 60;

const STORAGE_KEY = "obrazio:last-generation";
/** Wszystkie generowania klienta w tej przeglądarce (same id, najnowsze pierwsze). Podglądy są na serwerze. */
const HISTORY_KEY = "obrazio:history";
const HISTORY_LIMIT = 12;
const EMPTY_SLOTS = Array.from({ length: SITE.variantCount }, (_, i) => i);

function readHistory(): string[] {
  try {
    const ids: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeHistory(ids: string[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([...new Set(ids)].slice(0, HISTORY_LIMIT)));
  } catch {}
}

const PROMPT_EXAMPLES = [
  "Nasz pies jako portret szlachcica w stylu XVII wieku",
  "Portret osoby ze zdjęcia w stroju nauczyciela, przy tablicy w klasie",
  "Rodzinne zdjęcie z wakacji jako plakat w stylu retro",
  "Dom dziadków zimą, w nocy, z ciepłym światłem w oknach",
];

function cssAspect(aspect: string) {
  return aspect.replace(":", " / ");
}

function orientationFromAspect(aspect: string): Orientation {
  const found = (Object.keys(ORIENTATIONS) as Orientation[]).find((o) => ORIENTATIONS[o].aspect === aspect);
  return found ?? "portrait";
}

export function Creator() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [styleId, setStyleId] = useState("watercolor");
  const [prompt, setPrompt] = useState("");
  const [rights, setRights] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [generation, setGeneration] = useState<GenerationView | null>(null);
  const [history, setHistory] = useState<GenerationView[]>([]);
  const [selected, setSelected] = useState<VariantView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const configuratorRef = useRef<HTMLDivElement>(null);
  const wallRef = useRef<HTMLElement>(null);

  // Zwolnij pamięć podglądu zdjęcia przy zmianie lub wyjściu ze strony
  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  const fetchGeneration = useCallback(async (id: string) => {
    const res = await fetch(`/api/generations/${id}`, { cache: "no-store" });
    if (!res.ok) throw new Error("not-found");
    return (await res.json()) as GenerationView;
  }, []);

  // Po powrocie ze Stripe (albo odświeżeniu strony) przywracamy ostatnie propozycje i wcześniejsze obrazy.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* przeglądarka bez dostępu do pamięci */
    }
    const ids = [...new Set([...(stored ? [stored] : []), ...readHistory()])];
    if (!ids.length) return;
    const paymentCancelled = new URLSearchParams(window.location.search).get("platnosc") === "anulowana";
    Promise.allSettled(ids.map((id) => fetchGeneration(id))).then((results) => {
      const found = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
      // Generowania usunięte z serwera znikają też z przeglądarki.
      writeHistory(found.map((g) => g.id));
      setHistory(found);
      const last = found.find((g) => g.id === stored);
      if (last) {
        setGeneration(last);
        setOrientation(orientationFromAspect(last.aspectRatio));
        if (paymentCancelled) setNotice("Płatność została przerwana. Twoje propozycje nadal tu są.");
      } else if (stored) {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {}
      }
    });
  }, [fetchGeneration]);

  /** Generowanie zdejmowane ze ściany trafia do historii w aktualnym stanie. */
  function keepInHistory(g: GenerationView | null) {
    if (!g) return;
    setHistory((h) => (h.some((x) => x.id === g.id) ? h.map((x) => (x.id === g.id ? g : x)) : [g, ...h]));
  }

  // Odpytywanie, dopóki AI pracuje
  useEffect(() => {
    if (!generation || generation.status !== "running") return;
    const timer = setInterval(async () => {
      try {
        setGeneration(await fetchGeneration(generation.id));
      } catch {
        /* spróbujemy przy następnym tyknięciu */
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [generation, fetchGeneration]);

  const status = generation?.status;
  const isRunning = status === "running";
  const doneCount = generation?.variants.filter((v) => v.status === "done").length ?? 0;

  // Zegar do licznika czasu na ścianie – tyka tylko podczas malowania.
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isRunning]);

  // Postęp w tytule karty – widać go, nawet gdy klient przełączy się na inną kartę.
  useEffect(() => {
    if (!isRunning) return;
    const original = document.title;
    document.title = `Maluję… ${doneCount} z ${SITE.variantCount} – ${SITE.name}`;
    return () => {
      document.title = original;
    };
  }, [isRunning, doneCount]);

  // Jeśli obrazy skończyły się malować, gdy klient był na innej karcie – daj znać w tytule.
  const wasRunning = useRef(false);
  useEffect(() => {
    const finishedNow = wasRunning.current && status === "done";
    wasRunning.current = status === "running";
    if (!finishedNow || !document.hidden) return;
    const original = document.title;
    document.title = `Obrazy gotowe! – ${SITE.name}`;
    const restore = () => {
      if (document.hidden) return;
      document.title = original;
      document.removeEventListener("visibilitychange", restore);
    };
    document.addEventListener("visibilitychange", restore);
    return () => document.removeEventListener("visibilitychange", restore);
  }, [status]);

  function pickFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Wybierz zdjęcie JPG, PNG lub WEBP.");
      return;
    }
    if (file.size > SITE.maxUploadMb * 1024 * 1024) {
      setError(`To zdjęcie ma ponad ${SITE.maxUploadMb} MB. Wybierz mniejsze.`);
      return;
    }
    setPhoto(file);
    setPhotoUrl(URL.createObjectURL(file));
  }

  async function startGeneration(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!photo) return setError("Dodaj zdjęcie, z którego powstanie obraz.");
    if (styleId === "free" && prompt.trim().length < 3) {
      return setError("Opisz, jaki obraz chcesz dostać, albo wybierz styl.");
    }
    if (!rights) return setError("Potwierdź, że możesz użyć tego zdjęcia.");

    const form = new FormData();
    form.set("photo", photo);
    form.set("prompt", prompt);
    form.set("styleId", styleId);
    form.set("orientation", orientation);
    form.set("rights", "on");

    setSubmitting(true);
    try {
      const res = await fetch("/api/generations", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Nie udało się rozpocząć generowania.");
      setSelected(null);
      keepInHistory(generation);
      setGeneration({
        id: json.id,
        status: "running",
        aspectRatio: ORIENTATIONS[orientation].aspect,
        createdAt: Date.now(),
        error: null,
        variants: EMPTY_SLOTS.map((position) => ({
          id: `pending-${position}`,
          position,
          status: "pending",
          previewUrl: null,
        })),
      });
      try {
        localStorage.setItem(STORAGE_KEY, json.id);
      } catch {}
      writeHistory([json.id, ...readHistory()]);
      // Na telefonie ściana jest pod formularzem – pokaż ją, żeby było widać postęp.
      const wall = wallRef.current;
      if (wall && wall.getBoundingClientRect().top > window.innerHeight * 0.6) {
        wall.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się rozpocząć generowania.");
    } finally {
      setSubmitting(false);
    }
  }

  function choose(variant: VariantView) {
    setSelected(variant);
    requestAnimationFrame(() =>
      configuratorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  function startOver() {
    keepInHistory(generation);
    setGeneration(null);
    setSelected(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  /** Wcześniejszy obraz wraca na ścianę i od razu otwiera się wybór ramy. */
  function chooseEarlier(earlier: GenerationView, variant: VariantView) {
    keepInHistory(generation);
    setGeneration(earlier);
    setOrientation(orientationFromAspect(earlier.aspectRatio));
    setNotice(null);
    try {
      localStorage.setItem(STORAGE_KEY, earlier.id);
    } catch {}
    choose(variant);
  }

  function clearHistory() {
    const keep = history.filter((g) => g.id === generation?.id);
    setHistory(keep);
    writeHistory(keep.map((g) => g.id));
  }

  const running = isRunning;
  const earlier = history
    .filter((g) => g.id !== generation?.id)
    .flatMap((g) => g.variants.filter((v) => v.status === "done" && v.previewUrl).map((v) => ({ g, v })));
  const aspect = cssAspect(generation?.aspectRatio ?? ORIENTATIONS[orientation].aspect);
  const elapsed = running && now && generation ? Math.max(0, Math.floor((now - generation.createdAt) / 1000)) : 0;

  if (selected && generation) {
    return (
      <div ref={configuratorRef} className="scroll-mt-6">
        <Configurator
          variant={selected}
          variants={generation.variants.filter((v) => v.status === "done")}
          orientation={orientationFromAspect(generation.aspectRatio)}
          onSelectVariant={setSelected}
          onBack={() => setSelected(null)}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-14">
      {/* Formularz */}
      <form onSubmit={startGeneration} className="flex flex-col gap-7" noValidate>
        <fieldset disabled={submitting || running} className="flex flex-col gap-7 disabled:opacity-60">
          <div>
            <span className="mb-2 block text-sm font-semibold">Zdjęcie</span>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pickFile(e.dataTransfer.files[0]);
              }}
              className={`flex cursor-pointer items-center gap-4 rounded-sm border-2 border-dashed bg-mat/70 p-3 transition-colors focus-within:border-cobalt ${
                dragOver ? "border-cobalt bg-mat" : "border-ink/25 hover:border-ink/50"
              }`}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              <span className="grid size-20 shrink-0 place-items-center overflow-hidden bg-wall-deep">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="Wybrane zdjęcie" className="size-full object-cover" />
                ) : (
                  <svg viewBox="0 0 24 24" className="size-8 text-ink-soft" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                    <rect x="3" y="5" width="18" height="14" rx="1" />
                    <circle cx="9" cy="10" r="1.8" />
                    <path d="m4 18 5.5-5 4 3.5 2.5-2 4 3.5" />
                  </svg>
                )}
              </span>
              <span className="text-sm leading-snug">
                {photo ? (
                  <>
                    <span className="block font-semibold break-all">{photo.name}</span>
                    <span className="text-ink-soft">Kliknij, aby wybrać inne</span>
                  </>
                ) : (
                  <>
                    <span className="block font-semibold">Wybierz zdjęcie lub upuść je tutaj</span>
                    <span className="text-ink-soft">JPG, PNG lub WEBP, do {SITE.maxUploadMb} MB</span>
                  </>
                )}
              </span>
            </label>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Kształt obrazu</legend>
            <div className="flex gap-2">
              {(Object.keys(ORIENTATIONS) as Orientation[]).map((o) => (
                <label
                  key={o}
                  className={`flex flex-1 cursor-pointer flex-col items-center gap-2 border-2 bg-mat/70 px-2 py-3 text-sm transition-colors has-focus-visible:outline-3 has-focus-visible:outline-cobalt ${
                    orientation === o ? "border-cobalt text-cobalt" : "border-transparent hover:border-ink/25"
                  }`}
                >
                  <input
                    type="radio"
                    name="orientation"
                    value={o}
                    checked={orientation === o}
                    onChange={() => setOrientation(o)}
                    className="sr-only"
                  />
                  <span aria-hidden className="grid h-7 place-items-center">
                    <span
                      className="block border-2 border-current"
                      style={{
                        width: o === "landscape" ? 28 : o === "square" ? 22 : 18,
                        height: o === "portrait" ? 24 : o === "square" ? 22 : 18,
                      }}
                    />
                  </span>
                  {ORIENTATIONS[o].label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Styl</legend>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <label
                  key={s.id}
                  className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition-colors has-focus-visible:outline-3 has-focus-visible:outline-cobalt ${
                    styleId === s.id
                      ? "border-cobalt bg-cobalt text-white"
                      : "border-ink/20 bg-mat/70 hover:border-ink/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="style"
                    value={s.id}
                    checked={styleId === s.id}
                    onChange={() => setStyleId(s.id)}
                    className="sr-only"
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="prompt" className="mb-2 block text-sm font-semibold">
              Co ma się znaleźć na obrazie?{" "}
              <span className="font-normal text-ink-soft">{styleId === "free" ? "" : "(opcjonalnie)"}</span>
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={600}
              rows={3}
              placeholder={PROMPT_EXAMPLES[0]}
              className="w-full resize-y border-2 border-transparent bg-mat/70 p-3 text-base leading-relaxed placeholder:text-ink-soft/70 focus:border-cobalt focus:outline-none"
            />
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {PROMPT_EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setPrompt(example)}
                  className="text-left text-ink-soft underline decoration-ink/25 underline-offset-4 hover:text-ink"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 text-sm leading-snug">
            <input
              type="checkbox"
              checked={rights}
              onChange={(e) => setRights(e.target.checked)}
              className="mt-0.5 size-4 accent-cobalt"
            />
            <span>
              To moje zdjęcie albo mam zgodę osób, które na nim są, i autora zdjęcia.
            </span>
          </label>
        </fieldset>

        {error ? (
          <p role="alert" className="border-l-4 border-alert bg-mat px-3 py-2 text-sm text-alert">
            {error}
          </p>
        ) : null}
        {notice ? <p className="border-l-4 border-cobalt bg-mat px-3 py-2 text-sm">{notice}</p> : null}

        {running ? (
          <p className="text-sm text-ink-soft">
            AI maluje dwie propozycje. Postęp widać przy ramach na ścianie, a gotowe obrazy pojawią się tam same.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={submitting}
              className="bg-cobalt px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-cobalt-deep disabled:opacity-60"
            >
              {submitting ? "Wysyłam zdjęcie…" : generation ? "Namaluj nowe propozycje" : "Namaluj dwie propozycje"}
            </button>
            {generation ? (
              <button type="button" onClick={startOver} className="text-sm underline underline-offset-4">
                Wyczyść ścianę
              </button>
            ) : null}
          </div>
        )}
      </form>

      {/* Ściana z propozycjami */}
      <section ref={wallRef} aria-label="Propozycje obrazów" className="min-w-0 scroll-mt-4">
        {running ? <GenerationProgress done={doneCount} total={SITE.variantCount} elapsed={elapsed} /> : null}
        <div className="grid grid-cols-2 gap-x-[6%] gap-y-10 px-[4%] py-4 sm:gap-y-12">
          {EMPTY_SLOTS.map((slot) => {
            const variant = generation?.variants.find((v) => v.position === slot);
            const slotStatus = variant?.status ?? "empty";
            if (variant && slotStatus === "done" && variant.previewUrl) {
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => choose(variant)}
                  className="group text-left"
                  aria-label={`Wybierz propozycję ${slot + 1}`}
                >
                  <FramedImage
                    src={variant.previewUrl}
                    aspect={aspect}
                    alt={`Propozycja ${slot + 1}`}
                    className="group-hover:-translate-y-1"
                  />
                  <span className="mt-3 inline-block bg-mat px-2.5 py-1 text-sm font-semibold text-cobalt group-hover:bg-cobalt group-hover:text-white">
                    Wybieram ten
                  </span>
                </button>
              );
            }
            return (
              <div key={slot}>
                <FramedImage
                  aspect={aspect}
                  state={slotStatus === "pending" ? "pending" : "empty"}
                  frameColor={slotStatus === "empty" ? "#b9c0b6" : undefined}
                >
                  {slotStatus === "pending" ? (
                    <p className="absolute inset-0 grid place-items-center p-3 text-center text-sm font-semibold text-ink-soft">
                      Maluję…
                    </p>
                  ) : null}
                  {slotStatus === "failed" ? (
                    <p className="absolute inset-0 grid place-items-center p-3 text-center text-sm text-ink-soft">
                      Ta propozycja się nie udała
                    </p>
                  ) : null}
                </FramedImage>
                <span className="mt-3 block h-7" aria-hidden />
              </div>
            );
          })}
        </div>
        <p className="mt-2 px-[4%] text-sm text-ink-soft" aria-live="polite">
          {!generation && "Tu zawisną dwie propozycje. Wybierzesz jedną, a my ją wydrukujemy."}
          {running && `Gotowe: ${doneCount} z ${SITE.variantCount}`}
          {generation?.status === "done" && "Kliknij obraz, który chcesz powiesić u siebie."}
          {generation?.status === "failed" && (generation.error ?? "Nie udało się. Spróbuj ponownie.")}
        </p>

        {earlier.length ? (
          <div className="mt-12 px-[4%]">
            <h2 className="font-display text-2xl tracking-tight">Twoje wcześniejsze obrazy</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Zapisujemy je w tej przeglądarce. Kliknij obraz, żeby wybrać do niego ramę i rozmiar.
            </p>
            <ul className="mt-4 flex flex-wrap gap-3">
              {earlier.map(({ g, v }) => (
                <li key={v.id}>
                  <button
                    type="button"
                    disabled={running}
                    onClick={() => chooseEarlier(g, v)}
                    aria-label="Zamów ten wcześniejszy obraz"
                    className="block w-20 border-4 border-mat bg-mat p-0.5 transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={v.previewUrl ?? ""}
                      alt=""
                      className="block w-full object-cover"
                      style={{ aspectRatio: cssAspect(g.aspectRatio) }}
                    />
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={clearHistory} className="mt-4 text-sm underline underline-offset-4">
              Usuń wcześniejsze obrazy z tej przeglądarki
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function formatElapsed(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Pasek nad ścianą: co się teraz dzieje, ile to już trwa i że wszystko jest w porządku. */
function GenerationProgress({ done, total, elapsed }: { done: number; total: number; elapsed: number }) {
  const slow = elapsed > EXPECTED_SECONDS;
  // Szacunek z upływu czasu (najwyżej 90%), a każdy gotowy obraz dopełnia swoją część paska.
  const inFlight = Math.min(elapsed / EXPECTED_SECONDS, 0.9);
  const percent = Math.round(((done + (total - done) * inFlight) / total) * 100);

  return (
    <div className="mx-[4%] mb-4 bg-mat px-4 py-4 sm:px-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-xl">AI maluje Twoje obrazy</p>
        <p className="text-sm text-ink-soft" aria-label={`Trwa ${formatElapsed(elapsed)}`}>
          {formatElapsed(elapsed)}
        </p>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden bg-wall-deep"
        role="progressbar"
        aria-label="Postęp malowania"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="h-full bg-oak transition-[width] duration-1000 ease-linear" style={{ width: `${percent}%` }} />
      </div>
      <ol className="mt-4 grid gap-1.5 text-sm">
        <ProgressStep state="done">Zdjęcie przesłane</ProgressStep>
        <ProgressStep state="active">
          Malowanie propozycji – gotowe {done} z {total}
        </ProgressStep>
        <ProgressStep state="todo">Wybierasz obraz, ramę i rozmiar</ProgressStep>
      </ol>
      <p className="mt-4 text-sm text-ink-soft">
        {slow
          ? "Trwa to dłużej niż zwykle, ale wciąż pracujemy. Zostaw tę stronę otwartą."
          : "Zwykle trwa to do minuty. Nie musisz nic klikać – obrazy same zawisną na ścianie."}
      </p>
    </div>
  );
}

function ProgressStep({ state, children }: { state: "done" | "active" | "todo"; children: React.ReactNode }) {
  const dot =
    state === "done" ? "bg-oak text-white" : state === "active" ? "breathe border-2 border-oak" : "border-2 border-wall-deep";
  return (
    <li className={`flex items-center gap-2.5 ${state === "todo" ? "text-ink-soft" : ""}`}>
      <span aria-hidden className={`grid size-5 shrink-0 place-items-center rounded-full text-xs ${dot}`}>
        {state === "done" ? "✓" : null}
      </span>
      <span className={state === "active" ? "font-semibold" : ""}>{children}</span>
      {state === "done" ? <span className="sr-only">(zrobione)</span> : null}
    </li>
  );
}
