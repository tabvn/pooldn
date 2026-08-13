import { requireViewer } from "@/lib/auth/server";
import { LeagueImportView } from "./view";

export default async function AdminLeagueImportPage() {
  await requireViewer({ next: "/admin/league-import", roles: ["SUPER_ADMIN"] });
  return <LeagueImportView />;
}
