"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Quote } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { draftQuoteMessage, draftWinBack, sendReminder } from "./actions";

export default function SendPanel({
  quote,
  shareToken,
  canDraftMessage = false,
  canWinBack = false,
}: {
  quote: Quote;
  shareToken?: string;
  canDraftMessage?: boolean;
  canWinBack?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [texting, setTexting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [drafting, setDrafting] = useState(false);

  const shareUrl = `${
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL ?? "")
  }/q/${shareToken ?? quote.share_token}`;

  // A drafted message leads; otherwise fall back to the plain default line.
  const smsBody = encodeURIComponent(
    message.trim()
      ? `${message.trim()}\n\n${shareUrl}`
      : `Here's your quote for "${quote.title}" — view and accept it here: ${shareUrl}`
  );

  // A declined quote gets the win-back draft; otherwise the normal send message.
  const winBackMode = quote.status === "declined" && canWinBack;

  async function draftMessage() {
    setDrafting(true);
    setError(null);
    const result = winBackMode
      ? await draftWinBack(quote.id)
      : await draftQuoteMessage(quote.id);
    setDrafting(false);
    if (result.ok) setMessage(result.text);
    else setError(result.message ?? "Couldn't draft a message.");
  }

  async function copyMessage() {
    setError(null);
    try {
      await navigator.clipboard.writeText(`${message.trim()}\n\n${shareUrl}`);
      toast("Message + link copied.");
    } catch {
      setError("Copy failed.");
    }
  }

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
      toast(`Quote emailed to ${email}.`);
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
      toast("Link copied — paste it anywhere.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Copy failed");
    }
  }

  async function textIt() {
    setError(null);
    setTexting(true);
    try {
      // Marking the quote sent is a network call — give feedback so the
      // delay before the SMS app opens isn't silent.
      await markSent("link");
    } catch {
      // Still open the SMS composer even if marking sent failed.
    }
    toast("Opening your messages app…");
    setTexting(false);
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

      {(winBackMode || (canDraftMessage && quote.status !== "declined")) && (
        <div className="mt-3">
          {winBackMode && !message && (
            <p className="mb-2 text-xs text-zinc-500">
              They declined — draft a friendly note to reopen the conversation.
            </p>
          )}
          {message ? (
            <>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
              <div className="mt-1 flex items-center justify-between text-xs">
                <button
                  onClick={draftMessage}
                  disabled={drafting}
                  className="font-medium text-amber-700 disabled:opacity-50"
                >
                  {drafting ? "Drafting…" : "↻ Redraft"}
                </button>
                <button
                  onClick={copyMessage}
                  className="font-medium text-amber-700"
                >
                  Copy message + link
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={draftMessage}
              disabled={drafting}
              className="w-full rounded-xl border border-amber-300 bg-amber-50 py-2.5 text-sm font-semibold text-amber-800 disabled:opacity-50"
            >
              {drafting
                ? "Drafting…"
                : winBackMode
                  ? "✨ Draft a win-back message"
                  : "✨ Draft a message for the customer"}
            </button>
          )}
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 text-sm font-semibold">
        <button
          onClick={sendEmailNow}
          disabled={sending || !email}
          className="rounded-xl bg-zinc-900 py-3 text-white disabled:opacity-40"
        >
          {sending ? "Sending…" : "📧 Email"}
        </button>
        <button
          onClick={textIt}
          disabled={texting}
          className="rounded-xl border border-zinc-300 py-3 text-zinc-700 disabled:opacity-50"
        >
          {texting ? "Opening…" : "💬 Text"}
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
              if (result.ok) toast("Reminder sent.");
              else setError(result.message ?? "Couldn't send reminder");
            }}
            disabled={sending}
            className="mt-2 w-full rounded-xl border border-zinc-300 py-2.5 text-sm font-medium text-zinc-700 disabled:opacity-50"
          >
            🔔 Send reminder
          </button>
        )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
