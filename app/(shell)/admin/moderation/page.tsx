import { requireViewer } from "@/lib/auth/server";
import { BannedAdmin } from "./view";

export default async function ModerationPage() {
  await requireViewer({ next: "/admin/moderation", roles: ["SUPER_ADMIN"] });
  return <BannedAdmin />;
}
