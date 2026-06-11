"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  async function sendMagicLink(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    setCodeError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setCodeError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setCodeError("That code didn't work — double-check it or resend the email.");
      setVerifying(false);
      return;
    }
    // Full navigation so the server sees the fresh session cookies.
    window.location.assign("/quotes");
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/quotemagic-logo.jpg"
          alt="QuoteMagic"
          className="mx-auto w-44 rounded-3xl"
        />
        <p className="mt-2 text-center text-sm text-zinc-500">
          Dictate the job. Send the quote. Same day.
        </p>

        {sent ? (
          <div className="mt-8">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm text-emerald-800">
              Check your email — we sent a sign-in link to{" "}
              <span className="font-medium">{email}</span>.
            </div>

            <form onSubmit={verifyCode} className="mt-6">
              <p className="text-center text-xs text-zinc-500">
                …or enter the sign-in code from the email
              </p>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6,8}"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="00000000"
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-center text-2xl font-semibold tracking-[0.3em] outline-none placeholder:text-zinc-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
              />
              <button
                type="submit"
                disabled={verifying || code.length < 6}
                className="mt-3 w-full rounded-xl bg-zinc-900 px-4 py-3 text-base font-semibold text-white disabled:opacity-50"
              >
                {verifying ? "Signing in…" : "Sign in with code"}
              </button>
              {codeError && (
                <p className="mt-2 text-center text-sm text-red-600">
                  {codeError}
                </p>
              )}
              <button
                type="button"
                onClick={() => sendMagicLink()}
                disabled={loading}
                className="mt-4 block w-full text-center text-xs text-zinc-400 underline underline-offset-2 disabled:opacity-50"
              >
                {loading ? "Resending…" : "Didn't get it? Resend"}
              </button>
            </form>
          </div>
        ) : (
          <form onSubmit={sendMagicLink} className="mt-8 space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none placeholder:text-zinc-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-base font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Sending…" : "Email me a sign-in link"}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <p className="text-center text-[11px] text-zinc-400">
              By signing in you agree to the{" "}
              <a href="/terms" className="underline underline-offset-2">
                Terms
              </a>{" "}
              and{" "}
              <a href="/privacy" className="underline underline-offset-2">
                Privacy Policy
              </a>
              .
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
