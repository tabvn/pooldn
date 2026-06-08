import { requireViewer } from "@/lib/auth/server";
import { InvitationsList } from "./list";

export default async function InvitationsPage() {
  await requireViewer({ next: "/invitations" });
  return <InvitationsList />;
}
