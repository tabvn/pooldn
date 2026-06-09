import { requireViewer } from "@/lib/auth/server";
import { FeedbackInbox } from "./inbox";

export default async function AdminFeedbackPage() {
  await requireViewer({
    next: "/admin/feedback",
    roles: ["SUPER_ADMIN"],
  });
  return <FeedbackInbox />;
}
