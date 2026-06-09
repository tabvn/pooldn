import { requireViewer } from "@/lib/auth/server";
import { SecurityLog } from "./view";

export default async function SecurityAdminPage() {
  await requireViewer({ next: "/admin/security", roles: ["SUPER_ADMIN"] });
  return <SecurityLog />;
}
