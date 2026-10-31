"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const FIELDS = [
  { name: "name", label: "Imię i nazwisko", autoComplete: "name", value: "Anna Testowa" },
  { name: "email", label: "E-mail", autoComplete: "email", type: "email", value: "anna@example.com" },
  { name: "phone", label: "Telefon", autoComplete: "tel", value: "+48 500 600 700" },
  { name: "line1", label: "Ulica i numer", autoComplete: "address-line1", value: "ul. Kwiatowa 12/3" },
  { name: "postalCode", label: "Kod pocztowy", autoComplete: "postal-code", value: "00-001" },
  { name: "city", label: "Miasto", autoComplete: "address-level2", value: "Warszawa" },
  { name: "country", label: "Kraj (kod)", autoComplete: "country", value: "PL" },
];

export function DevCheckoutForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const res = await fetch("/api/dev-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, orderId }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Nie udało się.");
      setPending(false);
      return;
    }
    router.push(`/zamowienie/${orderId}`);
  }

  return (
    <form onSubmit={submit} className="mt-8 grid gap-4">
      {FIELDS.map((f) => (
        <label key={f.name} className="grid gap-1 text-sm font-semibold">
          {f.label}
          <input
            name={f.name}
            type={f.type ?? "text"}
            defaultValue={f.value}
            autoComplete={f.autoComplete}
            required={f.name !== "phone"}
            className="border-2 border-transparent bg-mat/70 p-2.5 text-base font-normal focus:border-cobalt focus:outline-none"
          />
        </label>
      ))}
      {error ? (
        <p role="alert" className="border-l-4 border-alert bg-mat px-3 py-2 text-sm text-alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 bg-cobalt px-6 py-3.5 font-semibold text-white hover:bg-cobalt-deep disabled:opacity-60"
      >
        {pending ? "Zapisuję…" : "Zapłać testowo"}
      </button>
    </form>
  );
}
