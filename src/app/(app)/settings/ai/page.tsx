import { requireContractor } from "@/lib/contractor";
import InstructionsForm from "./InstructionsForm";

// Friendly, human-readable explanation of the quoting system prompt
// (src/lib/ai/quote.ts) plus the contractor's own standing instructions.
const RULES: { title: string; body: string }[] = [
  {
    title: "Your price book is the source of truth",
    body: "Every line is matched to your own items and priced with your prices and time estimates — never internet averages.",
  },
  {
    title: "It listens like a tradesperson",
    body: "Dictation comes from speech, so it expects slang, misheard words, and missing punctuation, and interprets them the way an experienced tradesperson would.",
  },
  {
    title: "Quantities come from what you said",
    body: "“About 20 feet” becomes a 20-foot line (rounded up sensibly, e.g. quoted at 25). It never invents work you didn’t mention.",
  },
  {
    title: "Labor is estimated per line",
    body: "Minutes per unit × quantity, assuming a single-person crew unless you say otherwise, including realistic setup and cleanup time.",
  },
  {
    title: "New work gets flagged, not hidden",
    body: "Anything your price book doesn’t cover is included with a fair-market guess and highlighted for you to price before sending.",
  },
  {
    title: "Photos are evidence",
    body: "Attached job-site photos refine quantities and site conditions. If a photo contradicts your dictation, your words win and the conflict is noted.",
  },
  {
    title: "It shows its homework",
    body: "Every quote lists the assumptions it made and questions worth confirming before you hit send. Your markup, tax, and deposit defaults are applied automatically.",
  },
];

export default async function AiRulesPage() {
  const { contractor } = await requireContractor();

  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-900">How the AI quotes</h1>
      <p className="mt-1 text-sm text-zinc-500">
        The rules every quote is built with — plus your own.
      </p>

      <ul className="mt-4 space-y-2">
        {RULES.map((rule) => (
          <li
            key={rule.title}
            className="rounded-xl bg-white p-3 ring-1 ring-zinc-200"
          >
            <p className="text-sm font-semibold text-zinc-900">{rule.title}</p>
            <p className="mt-0.5 text-xs text-zinc-600">{rule.body}</p>
          </li>
        ))}
      </ul>

      <InstructionsForm initial={contractor.quoting_instructions ?? ""} />
    </div>
  );
}
