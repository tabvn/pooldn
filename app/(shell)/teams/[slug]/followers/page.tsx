import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getClient } from "@/lib/apollo/client";
import { TeamDetailQuery } from "@/lib/graphql/operations/team.operations";
import { FollowerList } from "@/components/follower-list";

export default async function TeamFollowersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data } = await getClient().query({
    query: TeamDetailQuery,
    variables: { slug },
  });
  const team = data?.team;
  if (!team) notFound();
  return (
    <div className="max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Followers · {team.followerCount}</CardTitle>
        </CardHeader>
        <CardContent>
          <FollowerList entityType="TEAM" entityId={team.id} />
        </CardContent>
      </Card>
    </div>
  );
}
