import { requireViewer } from "@/lib/auth/server";
import { BannedAdmin } from "./view";

export default async function BannedAdminPage() {
  await requireViewer({ next: "/admin/banned", roles: ["SUPER_ADMIN"] });
  return <BannedAdmin />;
}
