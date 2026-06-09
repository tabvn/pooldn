import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageTitle } from "@/components/layout/page-title";
import { getClient } from "@/lib/apollo/client";
import { ProfileByUsernameQuery } from "@/lib/graphql/operations/profile.operations";
import { FollowerList } from "@/components/follower-list";

export default async function PlayerFollowersPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const { data } = await getClient().query({
    query: ProfileByUsernameQuery,
    variables: { username },
  });
  const user = data?.userByUsername;
  if (!user) notFound();
  return (
    <div className="flex flex-col">
      <PageTitle
        title={`${user.name} · Followers`}
        eyebrow={<span>{user.followerCount} following</span>}
      />
      <div className="p-8 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Followers</CardTitle>
          </CardHeader>
          <CardContent>
            <FollowerList entityType="USER" entityId={user.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
