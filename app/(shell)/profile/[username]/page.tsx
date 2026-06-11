import { notFound } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { RelativeTime } from "@/components/ui/relative-time";
import { Users } from "lucide-react";
import { BanUserButton } from "@/components/admin/ban-user-button";
import { FollowButton } from "@/components/follow-button";
import { PageTitle } from "@/components/layout/page-title";
import { getClient } from "@/lib/apollo/client";
import { getViewer } from "@/lib/auth/server";
import {
  ProfileByUsernameQuery,
} from "@/lib/graphql/operations/profile.operations";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const [{ data }, viewer] = await Promise.all([
    getClient().query({
      query: ProfileByUsernameQuery,
      variables: { username },
    }),
    getViewer(),
  ]);
  const user = data?.userByUsername;
  if (!user) notFound();

  // Self OR admin can drive the Edit affordance (Round-15 admin rule).
  const isSelf = viewer?.id === user.id;
  const isAdmin = viewer?.role === "SUPER_ADMIN";
  const canEdit = isSelf || isAdmin;
  // user.createdAt is stable across server/client (it's a fixed UTC instant),
  // but the *formatted* string depends on tz/locale. Render via the client
  // LocalDateTime helper to stay hydration-clean.
  void user.createdAt;

  return (
    <div className="flex flex-col">
      <PageTitle
        title={user.name}
        eyebrow={<span>@{user.username}</span>}
        actions={
          <div className="flex items-center gap-2">
            {/* Round-50 — surface following count separately from the
                follower chip the button renders. Both link to their list
                pages so the audience can drill into either side. */}
            <Link
              href={`/players/${user.username}/following`}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold text-muted-foreground hover:border-primary/50 hover:text-foreground"
              data-testid="following-count-link"
            >
              <Users className="size-3.5" />
              {user.followingCount} following
            </Link>
            {isSelf ? (
              <Link
                href={`/players/${user.username}/followers`}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold text-muted-foreground hover:border-primary/50 hover:text-foreground"
                data-testid="self-followers-count-link"
              >
                <Users className="size-3.5" />
                {user.followerCount} followers
              </Link>
            ) : null}
            {!isSelf ? (
              <FollowButton
                entityType="USER"
                entityId={user.id}
                isFollowing={user.isFollowing}
                followerCount={user.followerCount}
                followersHref={`/players/${user.username}/followers`}
                signedIn={!!viewer}
              />
            ) : null}
            {canEdit ? (
              isSelf ? (
                <Link href="/settings">
                  <Button variant="outline">Edit profile</Button>
                </Link>
              ) : (
                <Link href={`/admin/players/${user.username}/edit`}>
                  <Button variant="outline" data-testid="admin-edit-player">
                    Edit player (admin)
                  </Button>
                </Link>
              )
            ) : null}
            {isAdmin && !isSelf ? (
              <BanUserButton
                userId={user.id}
                userName={user.name}
                bannedAt={user.bannedAt ?? null}
              />
            ) : null}
          </div>
        }
        meta={
          <>
            {/* Round-54 — dropped Level + Rank chips with the rating
                system; profile meta is just role + banned status now. */}
            <Badge variant="primary">{user.role.replace(/_/g, " ")}</Badge>
            {user.bannedAt ? (
              <Badge variant="danger" data-testid="profile-banned-badge">
                Banned
              </Badge>
            ) : null}
            {/* Round-50 — show ONLY the city the player picked in Settings.
                Pairing the nationality flag with the city was misleading
                (e.g. Vietnamese flag rendered next to "Toronto, Canada"
                because nationality + residence are different fields). */}
            {user.city ? (
              <span>
                {user.city.name}, {user.city.country.name}
              </span>
            ) : null}
            <span
              title={new Date(user.createdAt).toLocaleDateString()}
              data-testid="profile-joined-at"
            >
              Joined <RelativeTime value={user.createdAt} /> ·{" "}
              <LocalDateTime value={user.createdAt} variant="date" />
            </span>
          </>
        }
      />
      <div className="mx-auto max-w-5xl space-y-8 p-6 md:p-10">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Round-50 — About card. PageTitle above already shows name +
              @username + meta + actions; this card used to repeat the
              avatar, name and username inside its own CardHeader which
              read as duplicate content. Keep the avatar as a visual
              anchor and let the bio carry the rest. */}
          <Card className="md:col-span-2" data-testid="player-about-card">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Avatar
                  size="xl"
                  src={user.avatarUrl ?? undefined}
                  fallback={user.name}
                />
                <div className="min-w-0 flex-1 space-y-3 text-sm">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    About
                  </div>
                  {user.bio ? (
                    <p className="text-foreground">{user.bio}</p>
                  ) : (
                    <p className="italic text-muted-foreground">
                      {isSelf
                        ? "Your bio is empty — tell people who you are."
                        : "This player hasn't written a bio yet."}
                    </p>
                  )}
                  {isSelf ? (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Email · </span>
                      <span className="font-mono">{user.email}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Round-54 — Rating card removed with the rating system. We'll
              add a points card back once the new scoring model lands. */}
        </div>

        {/* Round-50 — Teams strip. Horizontal-scrolling card row so the
            page handles users in many teams without ballooning. Captain
            badge on teams the user captains, member count on the rest.
            "+N more" tail card links to a richer view if there are more
            than the limit (currently the strip caps at 8). */}
        {user.teams.length > 0 ? (
          <section
            className="space-y-3"
            data-testid="player-teams-strip"
          >
            <header className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Teams
              </h2>
              <Badge variant="neutral" size="sm">
                {user.teamsCount}
              </Badge>
            </header>
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
              {user.teams.map((t) => {
                const isCaptain = t.captain.id === user.id;
                return (
                  <Link
                    key={t.id}
                    href={`/teams/${t.slug}`}
                    className="flex w-60 shrink-0 snap-start flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                    data-testid={`player-team-${t.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        size="lg"
                        src={t.logoUrl ?? undefined}
                        fallback={t.name}
                        shape="team"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold">
                            {t.name}
                          </span>
                          {isCaptain ? (
                            <Badge variant="primary" size="sm">
                              Captain
                            </Badge>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t.members.length} member
                          {t.members.length === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
              {user.teamsCount > user.teams.length ? (
                <div
                  className="flex w-40 shrink-0 snap-start items-center justify-center rounded-xl border border-dashed border-border bg-card/40 text-xs text-muted-foreground"
                  data-testid="player-teams-more"
                >
                  +{user.teamsCount - user.teams.length} more
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* Competition history */}
        <Card data-testid="player-competition-history">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Competition history</CardTitle>
              <Badge variant="neutral" size="sm">
                {user.playerCompStats.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {user.playerCompStats.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {isSelf
                  ? "You haven't played in any competitions yet — apply or accept an invite to get started."
                  : "This player hasn't played in any competitions yet."}
              </p>
            ) : (
              <ul className="space-y-2">
                {user.playerCompStats.map((s) => {
                  const pct =
                    s.winRate !== null && s.winRate !== undefined
                      ? Math.round(s.winRate * 100)
                      : null;
                  return (
                    <li key={s.id}>
                      <Link
                        href={`/competitions/${s.competition.slug}`}
                        className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 hover:border-primary/40"
                        data-testid={`history-${s.competition.slug}`}
                      >
                        <Avatar
                          size="sm"
                          src={s.competition.bannerUrl ?? undefined}
                          fallback={s.competition.name}
                          shape="competition"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-semibold">
                              {s.competition.name}
                            </span>
                            {s.isMvp ? (
                              <Badge variant="warning" size="sm">
                                MVP
                              </Badge>
                            ) : null}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {s.competition.status
                              .replace(/_/g, " ")
                              .toLowerCase()}{" "}
                            · {s.competition.gameType
                              .replace(/_/g, "-")
                              .toLowerCase()}
                            {s.competition.startDate ? (
                              <>
                                {" · "}
                                <LocalDateTime
                                  value={s.competition.startDate}
                                  variant="date"
                                />
                              </>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 text-xs">
                          <span className="font-semibold tabular-nums">
                            {s.matchesPlayed} matches
                          </span>
                          <span className="text-muted-foreground tabular-nums">
                            {s.framesWon}/{s.framesPlayed} frames
                            {pct != null ? ` · ${pct}%` : ""}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
