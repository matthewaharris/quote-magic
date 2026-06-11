"use client";

import { useEffect, useRef, useState } from "react";

// Minimal typings for the Web Speech API (not in lib.dom for all targets).
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => SpeechRecognitionLike)
    | null;
}

export default function Dictation({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Keep latest value in a ref so recognition callbacks append to fresh text.
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    setSupported(getSpeechRecognition() !== null);
    return () => recognitionRef.current?.stop();
  }, []);

  function start() {
    const SR = getSpeechRecognition();
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (event) => {
      let interimText = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      if (finalText) {
        const base = valueRef.current.trimEnd();
        onChange(base ? `${base} ${finalText.trim()}` : finalText.trim());
      }
      setInterim(interimText);
    };
    rec.onerror = () => {
      setListening(false);
      setInterim("");
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };

    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  function stop() {
    recognitionRef.current?.stop();
    setListening(false);
    setInterim("");
  }

  return (
    <div>
      <div className="flex justify-center">
        <button
          type="button"
          onClick={listening ? stop : start}
          disabled={!supported}
          className={`flex h-24 w-24 items-center justify-center rounded-full text-4xl shadow-lg transition ${
            listening
              ? "animate-pulse bg-red-500"
              : "bg-zinc-900 hover:bg-zinc-700"
          } disabled:opacity-40`}
          aria-label={listening ? "Stop dictation" : "Start dictation"}
        >
          🎙️
        </button>
      </div>
      <p className="mt-2 text-center text-sm text-zinc-500">
        {!supported
          ? "Voice input isn't supported in this browser — type the job below."
          : listening
            ? "Listening… tap to stop"
            : "Tap to dictate the job"}
      </p>

      <textarea
        value={interim ? `${value} ${interim}` : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={8}
        className="mt-4 w-full rounded-xl border border-zinc-300 bg-white p-3 text-base outline-none placeholder:text-zinc-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
      />
    </div>
  );
}
