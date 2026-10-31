import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/config/site";
import "./globals.css";

export const metadata: Metadata = {
  title: `${SITE.name} – ${SITE.tagline}`,
  description:
    "Prześlij zdjęcie, a AI namaluje z niego dwie propozycje obrazu. Wybierz jedną, a wydrukujemy ją i wyślemy w ramie.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl" className="h-full">
      <body className="flex min-h-full flex-col">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-5 pt-6 pb-4 sm:px-8">
          <Link href="/" className="font-display text-3xl leading-none tracking-tight">
            {SITE.name}
          </Link>
          <nav className="flex gap-5 text-sm">
            <Link href="/#jak-to-dziala" className="hover:underline hover:underline-offset-4">
              Jak to działa
            </Link>
            <Link href="/#ceny" className="hover:underline hover:underline-offset-4">
              Ceny
            </Link>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="mt-24 border-t border-ink/10">
          <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-5 py-8 text-sm text-ink-soft sm:px-8">
            <p>
              © {SITE.name}. Drukujemy na zamówienie i wysyłamy do {SITE.shippingCountries.length} krajów.
            </p>
            <p>Uzupełnij tu dane firmy, regulamin i politykę prywatności.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
