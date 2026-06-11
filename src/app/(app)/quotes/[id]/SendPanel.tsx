"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Quote } from "@/lib/types";
import { sendReminder } from "./actions";

export default function SendPanel({ quote }: { quote: Quote }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shareUrl = `${
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL ?? "")
  }/q/${quote.share_token}`;

  const smsBody = encodeURIComponent(
    `Here's your quote for "${quote.title}" — view and accept it here: ${shareUrl}`
  );

  async function markSent(via: "email" | "link") {
    const res = await fetch(`/api/quotes/${quote.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        via,
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Send failed");
    router.refresh();
  }

  async function sendEmailNow() {
    setSending(true);
    setError(null);
    try {
      await markSent("email");
      setNotice(`Quote emailed to ${email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  async function copyLink() {
    setError(null);
    try {
      await navigator.clipboard.writeText(shareUrl);
      await markSent("link");
      setNotice("Link copied — paste it anywhere.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Copy failed");
    }
  }

  async function textIt() {
    setError(null);
    try {
      await markSent("link");
    } catch {
      // Still open the SMS composer even if marking sent failed.
    }
    window.location.href = `sms:${phone ? encodeURIComponent(phone) : ""}?&body=${smsBody}`;
  }

  return (
    <div className="mt-6 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Send to customer
      </h2>

      <div className="mt-3 space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Customer name"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-sm font-semibold">
        <button
          onClick={sendEmailNow}
          disabled={sending || !email}
          className="rounded-xl bg-zinc-900 py-3 text-white disabled:opacity-40"
        >
          📧 Email
        </button>
        <button
          onClick={textIt}
          className="rounded-xl border border-zinc-300 py-3 text-zinc-700"
        >
          💬 Text
        </button>
        <button
          onClick={copyLink}
          className="rounded-xl border border-zinc-300 py-3 text-zinc-700"
        >
          🔗 Copy link
        </button>
      </div>

      {quote.status !== "draft" && (
        <p className="mt-3 text-xs text-zinc-500">
          Sent{quote.sent_at ? ` ${new Date(quote.sent_at).toLocaleString()}` : ""}.
          Status: <span className="font-medium capitalize">{quote.status}</span>
        </p>
      )}
      {(quote.status === "sent" || quote.status === "viewed") &&
        quote.customer_id && (
          <button
            onClick={async () => {
              setSending(true);
              setError(null);
              const result = await sendReminder(quote.id);
              setSending(false);
              if (result.ok) setNotice("Reminder sent.");
              else setError(result.message ?? "Couldn't send reminder");
            }}
            disabled={sending}
            className="mt-2 w-full rounded-xl border border-zinc-300 py-2.5 text-sm font-medium text-zinc-700 disabled:opacity-50"
          >
            🔔 Send reminder
          </button>
        )}
      {notice && <p className="mt-2 text-sm text-emerald-700">{notice}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
