import { redirect } from "next/navigation";
import { requireContractor } from "@/lib/contractor";
import OnboardingForm from "./OnboardingForm";

export default async function OnboardingPage() {
  const { contractor } = await requireContractor();
  if (contractor.onboarded_at) redirect("/quotes");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-3xl font-bold tracking-tight text-zinc-900">
          Quote<span className="text-amber-600">Magic</span>
        </h1>
        <p className="mt-2 text-center text-sm text-zinc-500">
          Two quick details and you&apos;re quoting.
        </p>
        <OnboardingForm />
      </div>
    </main>
  );
}
