import { requireViewer } from "@/lib/auth/server";
import { ReportsAdmin } from "./view";

export default async function AdminReportsPage() {
  await requireViewer({ next: "/admin/reports", roles: ["SUPER_ADMIN"] });
  return <ReportsAdmin />;
}
