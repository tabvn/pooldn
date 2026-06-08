import { requireViewer } from "@/lib/auth/server";
import { SettingsForm } from "./form";

export default async function SettingsPage() {
  await requireViewer({ next: "/settings" });
  return <SettingsForm />;
}
