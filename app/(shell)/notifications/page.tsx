import { requireViewer } from "@/lib/auth/server";
import { NotificationsInbox } from "./inbox";

export default async function NotificationsPage() {
  await requireViewer({ next: "/notifications" });
  return <NotificationsInbox />;
}
