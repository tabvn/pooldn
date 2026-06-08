import { requireViewer } from "@/lib/auth/server";
import { NewCompetitionForm } from "./form";

export default async function NewCompetitionPage() {
  await requireViewer({
    next: "/competitions/new",
    roles: ["ORGANIZER", "SUPER_ADMIN"],
  });
  return <NewCompetitionForm />;
}
