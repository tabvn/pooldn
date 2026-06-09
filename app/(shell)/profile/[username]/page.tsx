import { notFound } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CountryFlag } from "@/components/ui/country-flag";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { RatingBadge } from "@/components/ui/rating-badge";
import { pointsToNextTier, tierFromRating } from "@/lib/rating/tier";
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
            <RatingBadge rating={user.rating} size="md" showRating />
            <Badge variant="primary">{user.role.replace(/_/g, " ")}</Badge>
            {user.bannedAt ? (
              <Badge variant="danger" data-testid="profile-banned-badge">
                Banned
              </Badge>
            ) : null}
            {user.city ? (
              <span>
                {user.city.name}, {user.city.country.name}
              </span>
            ) : null}
            {user.nationality ? (
              <span className="inline-flex items-center gap-1.5">
                <CountryFlag code={user.nationality} className="text-base leading-none" />
                <span>{user.nationality}</span>
              </span>
            ) : null}
            <span>
              Joined <LocalDateTime value={user.createdAt} variant="date" />
            </span>
          </>
        }
      />
      <div className="p-4 md:p-8 max-w-5xl space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-4">
                <Avatar
                  size="xl"
                  src={user.avatarUrl ?? undefined}
                  fallback={user.name}
                />
                <div>
                  <CardTitle>{user.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">@{user.username}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {user.bio ? (
                <p className="text-foreground">{user.bio}</p>
              ) : (
                <p className="text-muted-foreground italic">
                  {isSelf
                    ? "Your bio is empty — tell people who you are."
                    : "This player hasn't written a bio yet."}
                </p>
              )}
              {isSelf ? (
                <div>
                  <span className="text-xs text-muted-foreground">Email: </span>
                  <span>{user.email}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Rating + rank */}
          <Card data-testid="player-rating-card">
            <CardHeader>
              <CardTitle className="text-sm">Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <RatingBadge rating={user.rating} variant="hero" />
                {(() => {
                  const tier = tierFromRating(user.rating);
                  const remaining = pointsToNextTier(user.rating);
                  if (tier.next === null) {
                    return (
                      <p className="text-xs text-muted-foreground">
                        {tier.blurb} You've reached the top tier.
                      </p>
                    );
                  }
                  const span = tier.next - tier.min;
                  const progress = Math.min(
                    100,
                    Math.max(0, ((user.rating - tier.min) / span) * 100),
                  );
                  return (
                    <>
                      <p className="text-xs text-muted-foreground">
                        {tier.blurb}
                      </p>
                      <div className="space-y-1.5">
                        <div className="flex items-baseline justify-between text-[11px]">
                          <span className="font-semibold">{tier.name}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {remaining} pts to next
                          </span>
                        </div>
                        <div
                          className="h-2 w-full overflow-hidden rounded-full bg-secondary/60"
                          role="progressbar"
                          aria-valuemin={tier.min}
                          aria-valuemax={tier.next ?? user.rating}
                          aria-valuenow={user.rating}
                          data-testid="tier-progress"
                        >
                          <div
                            className="h-full rounded-full transition-[width]"
                            style={{
                              width: `${progress}%`,
                              background: tier.gradient,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
                          <span>{tier.min}</span>
                          <span>{tier.next}</span>
                        </div>
                      </div>
                    </>
                  );
                })()}
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <Badge variant="primary" size="sm">
                      Lv {user.level}
                    </Badge>
                  </span>
                  {user.rank ? (
                    <Link
                      href="/rankings"
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    >
                      Rank{" "}
                      <span className="font-mono font-bold">
                        #{user.rank}
                      </span>{" "}
                      ↗
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Unranked</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
