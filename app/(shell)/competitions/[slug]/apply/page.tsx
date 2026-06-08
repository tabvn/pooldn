import { requireViewer } from "@/lib/auth/server";
import { ApplyForm } from "./form";

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireViewer({
    next: `/competitions/${slug}/apply`,
    roles: ["TEAM_CAPTAIN", "SUPER_ADMIN"],
  });
  return <ApplyForm slug={slug} />;
}
