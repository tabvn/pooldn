import { requireViewer } from "@/lib/auth/server";
import { NewTeamForm } from "./form";

export default async function NewTeamPage() {
  await requireViewer({
    next: "/teams/new",
    roles: ["TEAM_CAPTAIN", "ORGANIZER", "SUPER_ADMIN"],
  });
  return <NewTeamForm />;
}
