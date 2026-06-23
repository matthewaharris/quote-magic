"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Dictation from "@/components/Dictation";
import { getJobTemplates } from "./actions";

type Template = { label: string; starter: string };

type Photo = { media_type: "image/jpeg"; data: string; preview: string };

const MAX_PHOTOS = 4;
const MAX_EDGE = 1568;

// Downscale on-device so payloads stay small and HEIC becomes JPEG.
async function fileToPhoto(file: File): Promise<Photo | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    return {
      media_type: "image/jpeg",
      data: dataUrl.split(",")[1],
      preview: dataUrl,
    };
  } catch {
    return null;
  }
}

export default function NewQuotePage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [transcript, setTranscript] = useState("");
  const [tiered, setTiered] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitHit, setLimitHit] = useState<"trial" | "quota" | null>(null);
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templatesUpsell, setTemplatesUpsell] = useState(false);

  async function loadTemplates() {
    setLoadingTemplates(true);
    setError(null);
    const result = await getJobTemplates();
    setLoadingTemplates(false);
    if (result.ok) setTemplates(result.templates);
    else if (result.upsell) setTemplatesUpsell(true);
    else setError(result.message ?? "Couldn't load templates.");
  }

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    setError(null);
    const room = MAX_PHOTOS - photos.length;
    const next: Photo[] = [];
    for (const file of [...files].slice(0, room)) {
      const photo = await fileToPhoto(file);
      if (photo) next.push(photo);
      else setError("Couldn't read one of the photos — skipped it.");
    }
    setPhotos((prev) => [...prev, ...next]);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          tiered,
          images: photos.map(({ media_type, data }) => ({ media_type, data })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "TRIAL_LIMIT" || data.code === "QUOTA_LIMIT") {
          setLimitHit(data.code === "QUOTA_LIMIT" ? "quota" : "trial");
          setGenerating(false);
          return;
        }
        throw new Error(data.error ?? "Something went wrong");
      }
      router.refresh();
      router.push(`/quotes/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setGenerating(false);
    }
  }

  if (limitHit) {
    return (
      <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
        <h1 className="text-lg font-bold text-amber-900">
          {limitHit === "quota"
            ? "You've used this month's quotes"
            : "Your free trial has ended"}
        </h1>
        <p className="mt-2 text-sm text-amber-800">
          {limitHit === "quota"
            ? "You've hit your plan's monthly quote limit. Upgrade for more, or wait for your next billing period."
            : "You've used up your free trial. Pick a plan and keep quoting — it takes about a minute."}
        </p>
        <a
          href="/settings/billing"
          className="mt-4 block w-full rounded-xl bg-amber-600 px-4 py-3 text-center text-base font-semibold text-white shadow"
        >
          {limitHit === "quota" ? "View plans & upgrade" : "Choose a plan"}
        </a>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-900">New Quote</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Describe the job like you&apos;d explain it to your apprentice —
        what&apos;s being installed, where, distances, anything unusual.
      </p>

      <div className="mt-4">
        {templates ? (
          templates.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-zinc-500">
                Start from a recurring job:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {templates.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => setTranscript(t.starter)}
                    className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-400">
              No recurring jobs found yet — send a few quotes and they&apos;ll
              show up here.
            </p>
          )
        ) : templatesUpsell ? (
          <p className="text-xs text-zinc-500">
            ✨ One-tap job templates are a{" "}
            <a href="/settings/billing" className="font-medium text-amber-700 underline">
              Pro
            </a>{" "}
            feature.
          </p>
        ) : (
          <button
            type="button"
            onClick={loadTemplates}
            disabled={loadingTemplates}
            className="text-sm font-medium text-amber-700 disabled:opacity-50"
          >
            {loadingTemplates ? "Finding your usual jobs…" : "✨ Start from a recurring job"}
          </button>
        )}
      </div>

      <div className="mt-4">
        <Dictation
          value={transcript}
          onChange={setTranscript}
          placeholder="e.g. Customer wants a sauna hooked up. Need a 50 amp breaker in the main panel, have to move a couple breakers to make room, run about 20 feet of 6/2 out to the sauna, 240 volt disconnect, add a GFCI outlet next to it, then hardwire the control box and the 9 kW heater…"
        />
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => addPhotos(e.target.files)}
      />
      {photos.length < MAX_PHOTOS && (
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="mt-3 w-full rounded-xl border-2 border-dashed border-zinc-300 py-3 text-sm font-medium text-zinc-500"
        >
          📷 Add photos (optional, up to {MAX_PHOTOS})
        </button>
      )}
      {photos.length > 0 && (
        <>
          <div className="mt-3 flex gap-2">
            {photos.map((photo, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.preview}
                  alt=""
                  className="h-16 w-16 rounded-lg object-cover ring-1 ring-zinc-200"
                />
                <button
                  type="button"
                  onClick={() =>
                    setPhotos((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] text-white"
                  aria-label="Remove photo"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Photos help the AI spot site conditions; they aren&apos;t saved or
            shown on the quote.
          </p>
        </>
      )}

      <label className="mt-4 flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={tiered}
          onChange={(e) => setTiered(e.target.checked)}
          className="h-4 w-4 accent-amber-600"
        />
        Give my customer 3 options (good / better / best)
      </label>

      <button
        onClick={generate}
        disabled={generating || transcript.trim().length < 10}
        className="mt-4 w-full rounded-xl bg-amber-600 px-4 py-4 text-base font-semibold text-white shadow disabled:opacity-50"
      >
        {generating
          ? "Building your quote…"
          : tiered
            ? "✨ Generate 3 options"
            : "✨ Generate quote"}
      </button>
      {generating && (
        <p className="mt-2 text-center text-sm text-zinc-500">
          Matching your price book — this takes{" "}
          {tiered ? "30–60" : photos.length > 0 ? "20–40" : "~20"} seconds.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
