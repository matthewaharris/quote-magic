import Link from "next/link";
import { redirect } from "next/navigation";
import { requireContractor } from "@/lib/contractor";
import { getUsageStatus } from "@/lib/billing";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, contractor } = await requireContractor();
  if (!contractor.onboarded_at) redirect("/onboarding");

  const header = (
    <header className="print-hide sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
      <Link
        href="/quotes"
        className="flex items-center gap-2 text-lg font-bold tracking-tight"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/quotemagic-icon.png"
          alt=""
          className="h-7 w-7 rounded-md"
        />
        {/* One flex item so the parent's gap-2 doesn't split the wordmark
            into "Quote Magic" — it reads as the single-word logo "QuoteMagic". */}
        <span>
          Quote<span className="text-amber-600">Magic</span>
        </span>
      </Link>
      <div className="flex items-center gap-3">
        {contractor.is_admin && (
          <Link
            href="/admin"
            className="text-xs font-medium text-amber-700 underline-offset-2 hover:underline"
          >
            Admin
          </Link>
        )}
        <Link
          href="/settings"
          className="max-w-40 truncate text-xs text-zinc-500 underline-offset-2 hover:underline"
        >
          {contractor.business_name || contractor.name || contractor.email}
        </Link>
        <form action="/auth/signout" method="post">
          <button className="text-xs text-zinc-400 underline">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );

  if (contractor.plan === "disabled") {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-zinc-50">
        {header}
        <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="text-3xl">🔒</p>
          <h1 className="mt-2 text-lg font-bold text-zinc-900">
            Account disabled
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Contact{" "}
            <a
              href="mailto:support@stait.ai?subject=QuoteMagic%20account"
              className="underline"
            >
              support
            </a>{" "}
            to restore access.
          </p>
        </main>
      </div>
    );
  }

  const usage = await getUsageStatus(supabase, contractor);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-zinc-50">
      {header}

      {usage.kind === "trial" && (
        <div
          className={`print-hide border-b px-4 py-2 text-center text-xs font-medium ${
            usage.expired
              ? "border-amber-300 bg-amber-100 text-amber-900"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {usage.expired ? (
            <>
              Free trial ended —{" "}
              <Link href="/settings/billing" className="underline">
                choose a plan
              </Link>{" "}
              to keep quoting
            </>
          ) : (
            <>
              Free trial: {usage.quotesRemaining}{" "}
              {usage.quotesRemaining === 1 ? "quote" : "quotes"} ·{" "}
              {usage.daysLeft} {usage.daysLeft === 1 ? "day" : "days"} left
            </>
          )}
        </div>
      )}
      {usage.kind === "paid" && usage.expired && (
        <div className="print-hide border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-900">
          You&apos;ve used this month&apos;s quotes —{" "}
          <Link href="/settings/billing" className="underline">
            upgrade your plan
          </Link>
        </div>
      )}

      <main className="flex-1 px-4 pb-24 pt-4">{children}</main>

      <nav className="print-hide fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-lg border-t border-zinc-200 bg-white">
        <div className="grid grid-cols-4 text-center text-xs font-medium text-zinc-600">
          <Link href="/quotes" className="py-3 hover:text-zinc-900">
            <div className="text-lg leading-none">📋</div>
            Quotes
          </Link>
          <Link href="/quotes/new" className="py-3 hover:text-zinc-900">
            <div className="text-lg leading-none">🎙️</div>
            New Quote
          </Link>
          <Link href="/schedule" className="py-3 hover:text-zinc-900">
            <div className="text-lg leading-none">📅</div>
            Schedule
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
