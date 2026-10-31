import { Creator } from "@/components/Creator";
import { KINDS, SIZES, PRODUCTS, type ProductKind } from "@/config/products";
import { SITE, formatPrice } from "@/config/site";

const STEPS = [
  {
    title: "Prześlij zdjęcie",
    body: "Zwierzak, dom, rodzina, ulubione miejsce. Dopisz, jak ma wyglądać obraz, albo wybierz gotowy styl.",
  },
  {
    title: "Wybierz jedną z dwóch propozycji",
    body: "AI maluje dwie różne wersje. Zobaczysz od razu, jak każda wygląda w ramie i w wybranym rozmiarze.",
  },
  {
    title: "Odbierz gotowy obraz",
    body: "Drukujemy na grubym papierze lub płótnie i wysyłamy kurierem. Zwykle w 3–7 dni roboczych.",
  },
];

const FAQ = [
  {
    q: "Czy mogę użyć dowolnego zdjęcia?",
    a: "Tylko takiego, do którego masz prawo: zrobionego przez Ciebie albo za zgodą autora i osób na zdjęciu. Nie przyjmujemy zdjęć z internetu chronionych prawem autorskim.",
  },
  {
    q: "Co jeśli żadna propozycja mi się nie spodoba?",
    a: "Zmień opis albo styl i namaluj nowe propozycje. Płacisz dopiero za obraz, który zamówisz.",
  },
  {
    q: "Czy obraz będzie ostry w dużym formacie?",
    a: `Każdy obraz przygotowujemy do druku w rozdzielczości co najmniej ${SITE.printDpi} DPI, dopasowanej do wybranego rozmiaru. Podgląd na stronie ma znak wodny, wydruk go nie ma.`,
  },
  {
    q: "Co dzieje się z moim zdjęciem?",
    a: "Używamy go tylko do namalowania propozycji i realizacji zamówienia. Zdjęcie przetwarza dostawca modelu AI, a wydruk – drukarnia.",
  },
];

export default function Home() {
  const kinds = Object.keys(KINDS) as ProductKind[];
  const rectSizes = SIZES.filter((s) => s.shape === "rect");
  const squareSizes = SIZES.filter((s) => s.shape === "square");
  const price = (kind: ProductKind, sizeId: string) => PRODUCTS.find((p) => p.kind === kind && p.size.id === sizeId)?.price;

  return (
    <>
      <section className="mx-auto max-w-6xl px-5 pt-10 pb-16 sm:px-8 sm:pt-16">
        <h1 className="max-w-3xl font-display text-5xl leading-[1.02] tracking-tight sm:text-7xl">
          Zdjęcie z telefonu, obraz na ścianie.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
          Prześlij zdjęcie i powiedz, co chcesz zobaczyć. AI namaluje dwie propozycje, a my wydrukujemy tę,
          którą wybierzesz, i wyślemy ją do Ciebie – w ramie albo na płótnie.
        </p>
        <div className="mt-12">
          <Creator />
        </div>
      </section>

      <section id="jak-to-dziala" className="scroll-mt-8 bg-mat/60">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <h2 className="font-display text-4xl tracking-tight">Jak to działa</h2>
          <ol className="mt-10 grid gap-10 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-5">
                <span className="w-8 shrink-0 font-display text-5xl leading-none text-oak" aria-hidden>
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 leading-relaxed text-ink-soft">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="ceny" className="mx-auto max-w-6xl scroll-mt-8 px-5 py-16 sm:px-8">
        <h2 className="font-display text-4xl tracking-tight">Ceny</h2>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Cena obejmuje wydruk i, dla obrazów w ramie, ramę z pleksi. Dostawa: {formatPrice(SITE.shippingPrice)}.
        </p>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-ink">
                <th className="py-3 pr-4 font-semibold">Rozmiar</th>
                {kinds.map((k) => (
                  <th key={k} className="py-3 pr-4 font-semibold">
                    {KINDS[k].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...rectSizes, ...squareSizes].map((s) => (
                <tr key={s.id} className="border-b border-ink/10">
                  <td className="py-3 pr-4">
                    {s.shortCm}×{s.longCm} cm
                  </td>
                  {kinds.map((k) => {
                    const p = price(k, s.id);
                    return (
                      <td key={k} className="py-3 pr-4">
                        {p ? formatPrice(p) : "–"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 sm:px-8">
        <h2 className="font-display text-4xl tracking-tight">Pytania</h2>
        <div className="mt-6 divide-y divide-ink/10 border-y border-ink/10">
          {FAQ.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="cursor-pointer list-none text-lg font-semibold marker:hidden">
                <span className="mr-3 inline-block w-4 text-oak transition-transform group-open:rotate-45">+</span>
                {item.q}
              </summary>
              <p className="mt-3 pl-7 leading-relaxed text-ink-soft">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
