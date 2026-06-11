import Link from "next/link";
import { requireContractor } from "@/lib/contractor";
import { getTrialStatus } from "@/lib/trial";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, contractor } = await requireContractor();
  const trial = await getTrialStatus(supabase, contractor);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-zinc-50">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
        <Link href="/quotes" className="text-lg font-bold tracking-tight">
          Quote<span className="text-amber-600">Magic</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="max-w-40 truncate text-xs text-zinc-500">
            {contractor.business_name || contractor.email}
          </span>
          <form action="/auth/signout" method="post">
            <button className="text-xs text-zinc-400 underline">
              Sign out
            </button>
          </form>
        </div>
      </header>

      {trial.onTrial && (
        <div
          className={`border-b px-4 py-2 text-center text-xs font-medium ${
            trial.expired
              ? "border-amber-300 bg-amber-100 text-amber-900"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {trial.expired ? (
            <>
              Free trial ended —{" "}
              <a
                href="mailto:mharris26@gmail.com?subject=QuoteMagic%20trial"
                className="underline"
              >
                contact us
              </a>
            </>
          ) : (
            <>
              Free trial: {trial.quotesRemaining}{" "}
              {trial.quotesRemaining === 1 ? "quote" : "quotes"} ·{" "}
              {trial.daysLeft} {trial.daysLeft === 1 ? "day" : "days"} left
            </>
          )}
        </div>
      )}

      <main className="flex-1 px-4 pb-24 pt-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-lg border-t border-zinc-200 bg-white">
        <div className="grid grid-cols-3 text-center text-xs font-medium text-zinc-600">
          <Link href="/quotes" className="py-3 hover:text-zinc-900">
            <div className="text-lg leading-none">📋</div>
            Quotes
          </Link>
          <Link href="/quotes/new" className="py-3 hover:text-zinc-900">
            <div className="text-lg leading-none">🎙️</div>
            New Quote
          </Link>
          <Link href="/pricebook" className="py-3 hover:text-zinc-900">
            <div className="text-lg leading-none">💲</div>
            Price Book
          </Link>
        </div>
      </nav>
    </div>
  );
}
