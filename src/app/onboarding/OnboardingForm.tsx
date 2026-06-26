"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "./actions";
import { trackRedditSignUp } from "@/lib/reddit";
import Turnstile from "@/components/Turnstile";

export default function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [website, setWebsite] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await completeOnboarding({
      name,
      phone,
      business_name: businessName,
      website_url: website,
      captchaToken,
    });
    if (!result.ok) {
      setError(result.message ?? "Could not save");
      setBusy(false);
      return;
    }
    // Reddit SignUp conversion (no-op without the pixel). This form only
    // renders for un-onboarded contractors, so success here is a true signup.
    trackRedditSignUp();
    // Land on the calendar first so new contractors set working hours and
    // block out existing commitments before their first quote goes out.
    router.push("/schedule?welcome=1");
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-3">
      <input
        required
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none placeholder:text-zinc-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
      />
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone (shown on quotes)"
        className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none placeholder:text-zinc-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
      />
      <input
        value={businessName}
        onChange={(e) => setBusinessName(e.target.value)}
        placeholder="Company name (optional)"
        className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none placeholder:text-zinc-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
      />
      <input
        type="text"
        inputMode="url"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        placeholder="Website (optional — we'll grab your logo)"
        className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none placeholder:text-zinc-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
      />
      <Turnstile onToken={setCaptchaToken} />
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-zinc-900 px-4 py-3.5 text-base font-semibold text-white disabled:opacity-50"
      >
        {busy
          ? website.trim()
            ? "Setting up — grabbing your logo…"
            : "Setting up…"
          : "Start quoting"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
