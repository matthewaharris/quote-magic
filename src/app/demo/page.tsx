import { getTrialDays } from "@/lib/settings";
import DemoClient from "./DemoClient";

// Server wrapper: fetch the admin-set trial length so the demo footer always
// matches the real signup terms. All interactivity lives in DemoClient.
export default async function DemoPage() {
  const trialDays = await getTrialDays();
  return <DemoClient trialDays={trialDays} />;
}
