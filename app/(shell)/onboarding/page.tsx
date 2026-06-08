import { requireViewer } from "@/lib/auth/server";
import { OnboardingForm } from "./form";

export default async function OnboardingPage() {
  const viewer = await requireViewer({ next: "/onboarding" });
  return <OnboardingForm viewerId={viewer.id} viewerName={viewer.name} />;
}
