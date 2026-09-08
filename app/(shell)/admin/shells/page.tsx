import { requireViewer } from "@/lib/auth/server";
import { ShellsAdmin } from "./view";

export default async function ShellsAdminPage() {
  await requireViewer({ next: "/admin/shells", roles: ["SUPER_ADMIN"] });
  return <ShellsAdmin />;
}
