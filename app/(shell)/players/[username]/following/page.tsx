import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PageTitle } from "@/components/layout/page-title";
import { getClient } from "@/lib/apollo/client";
import { ProfileByUsernameQuery } from "@/lib/graphql/operations/profile.operations";
import { FollowingTabs } from "./tabs";

/**
 * Round-50 — tabbed Following page. Players (default), Teams, Competitions.
 * Counts in the eyebrow + tab labels come from the server-resolved fields
 * on the User type.
 */
export default async function PlayerFollowingPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { username } = await params;
  const sp = await searchParams;
  const { data } = await getClient().query({
    query: ProfileByUsernameQuery,
    variables: { username },
  });
  const user = data?.userByUsername;
  if (!user) notFound();

  // Round-50 — fall back to the first non-empty category when ?tab= is
  // missing. Stops the "1 following but Players tab empty" confusion when
  // the user only follows teams or competitions.
  const requested =
    typeof sp.tab === "string" &&
    ["players", "teams", "competitions"].includes(sp.tab)
      ? (sp.tab as "players" | "teams" | "competitions")
      : null;
  const fallback: "players" | "teams" | "competitions" =
    user.followingUsersCount > 0
      ? "players"
      : user.followingTeamsCount > 0
        ? "teams"
        : user.followingCompetitionsCount > 0
          ? "competitions"
          : "players";
  const tab = requested ?? fallback;

  return (
    <div className="flex flex-col">
      <PageTitle
        title={`${user.name} · Following`}
        eyebrow={
          <span>
            {user.followingCount} following · {user.followerCount} followers
          </span>
        }
      />
      <div className="p-8 max-w-3xl">
        <Card>
          <CardContent className="pt-6">
            <FollowingTabs
              userId={user.id}
              initialTab={tab}
              counts={{
                players: user.followingUsersCount,
                teams: user.followingTeamsCount,
                competitions: user.followingCompetitionsCount,
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
