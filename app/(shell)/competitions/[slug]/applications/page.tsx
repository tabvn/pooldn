import { requireViewer } from "@/lib/auth/server";
import { ApplicationsList } from "./list";

export default async function ApplicationsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireViewer({
    next: `/competitions/${slug}/applications`,
    roles: ["ORGANIZER", "SUPER_ADMIN"],
  });
  return <ApplicationsList slug={slug} />;
}
