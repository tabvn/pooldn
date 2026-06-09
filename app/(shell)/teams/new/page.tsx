import { requireViewer } from "@/lib/auth/server";
import { NewTeamForm } from "./form";

export default async function NewTeamPage() {
  // Round-30 — any signed-in non-VIEWER can create a team. They become the
  // captain of THAT team via team.captainId; no global role change required.
  await requireViewer({
    next: "/teams/new",
    roles: ["PLAYER", "TEAM_CAPTAIN", "ORGANIZER", "SUPER_ADMIN"],
  });
  return <NewTeamForm />;
}
