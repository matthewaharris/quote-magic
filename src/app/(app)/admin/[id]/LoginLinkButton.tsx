"use client";

import { useActionState } from "react";
import { generateLoginLink } from "../actions";

export default function LoginLinkButton({
  contractorId,
}: {
  contractorId: string;
}) {
  const [state, formAction, pending] = useActionState(
    generateLoginLink.bind(null, contractorId),
    null
  );

  return (
    <div className="mt-3">
      <form action={formAction}>
        <button
          disabled={pending}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          {pending ? "Generating…" : "🔑 Generate sign-in link"}
        </button>
      </form>
      {state?.url && (
        <div className="mt-2">
          <input
            readOnly
            value={state.url}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[11px] text-zinc-600"
          />
          <p className="mt-1 text-[11px] text-zinc-400">
            Signs in as this contractor. Single use, expires in about an hour,
            and invalidates any magic link they just requested themselves.
          </p>
        </div>
      )}
      {state?.error && (
        <p className="mt-2 text-xs text-red-600">{state.error}</p>
      )}
    </div>
  );
}
