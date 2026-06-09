import { notFound } from "next/navigation";
import { getClient } from "@/lib/apollo/client";
import { CompetitionHeaderQuery } from "@/lib/graphql/operations/competition.operations";
import { FollowerList } from "@/components/follower-list";

export default async function CompetitionFollowersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data } = await getClient().query({
    query: CompetitionHeaderQuery,
    variables: { slug },
  });
  const c = data?.competition;
  if (!c) notFound();
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">
        Followers · {c.followerCount}
      </h2>
      <FollowerList entityType="COMPETITION" entityId={c.id} />
    </div>
  );
}
