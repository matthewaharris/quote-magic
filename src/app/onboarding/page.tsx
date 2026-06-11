import { redirect } from "next/navigation";
import { requireContractor } from "@/lib/contractor";
import OnboardingForm from "./OnboardingForm";

export default async function OnboardingPage() {
  const { contractor } = await requireContractor();
  if (contractor.onboarded_at) redirect("/quotes");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/quotemagic-logo.jpg"
          alt="QuoteMagic"
          className="mx-auto w-36 rounded-3xl"
        />
        <p className="mt-2 text-center text-sm text-zinc-500">
          Two quick details and you&apos;re quoting.
        </p>
        <OnboardingForm />
      </div>
    </main>
  );
}
