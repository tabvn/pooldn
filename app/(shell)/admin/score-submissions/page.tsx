import { requireViewer } from "@/lib/auth/server";
import { SubmissionsList } from "./list";

export default async function ScoreSubmissionsPage() {
  await requireViewer({
    next: "/admin/score-submissions",
    roles: ["ORGANIZER", "SUPER_ADMIN"],
  });
  return <SubmissionsList />;
}
