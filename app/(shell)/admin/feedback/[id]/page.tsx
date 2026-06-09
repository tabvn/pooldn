import { requireViewer } from "@/lib/auth/server";
import { FeedbackDetail } from "./view";

export default async function FeedbackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireViewer({
    next: `/admin/feedback/${id}`,
    roles: ["SUPER_ADMIN"],
  });
  return <FeedbackDetail id={id} />;
}
