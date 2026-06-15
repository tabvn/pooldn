import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CompetitionRowCard } from "@/components/competition/competition-row-card";
import { TodayMatchCard } from "@/components/dashboard/today-match-card";
import { getClient } from "@/lib/apollo/client";
import { DashboardQuery } from "@/lib/graphql/operations/dashboard.operations";
import { ViewerQuery } from "@/lib/graphql/operations/competition.operations";

function firstName(full?: string | null) {
  if (!full) return null;
  return full.trim().split(/\s+/)[0];
}

/**
 * Round-52 — Figma-faithful Poolhub dashboard.
 *
 * The redesign trades busy gradients and chip-colour soup for a single
 * column of restrained row cards (matches Figma frames 31:2138 + 10:161).
 * Only three accent colours touch the page: the lime welcome heading
 * (greets a signed-in user), the lime "Upcoming" status pill, and the
 * teal-tinted "Active" rows — everything else is foreground / muted.
 */
export default async function PoolhubDashboard() {
  const client = getClient();
  const [{ data }, viewerResult] = await Promise.all([
    client.query({ query: DashboardQuery, errorPolicy: "ignore" }),
    client.query({ query: ViewerQuery, errorPolicy: "ignore" }),
  ]);
  const viewer = data?.viewer ?? viewerResult.data?.viewer ?? null;
  // Round-47 — prefer the real "Today's Match" if there is one; fall back
  // to the next-scheduled match so the card still has content when nothing
  // is on today.
  const todayMatch = data?.viewerTodayMatch ?? null;
  const nextMatch = todayMatch ?? data?.viewerNextMatch ?? null;
  // Round-59 — the shared competitions resolver orders by startDate DESC
  // (furthest-future first, NULLs on top), which buried freshly-published
  // comps below the dashboard's top-3 cut. For "Upcoming" the actionable
  // order is soonest-starting first, with date-less comps last — so a comp
  // an organizer just opened for applications surfaces near the top.
  const bySoonestStart = (
    a: { startDate?: string | null },
    b: { startDate?: string | null },
  ) => {
    if (!a.startDate && !b.startDate) return 0;
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  };
  const upcoming = [...(data?.upcoming ?? [])].sort(bySoonestStart);
  const active = [...(data?.active ?? [])].sort(bySoonestStart);
  const followedComps = data?.myFollowedCompetitions ?? [];
  const followedTeams = data?.myFollowedTeams ?? [];
  const hasFollowing = followedComps.length > 0 || followedTeams.length > 0;
  // Round-57 — surface DRAFT comps the viewer is organizing so they can
  // resume editing without hunting through /competitions. Filter from
  // the broader `myCompetitions` so we don't add a new resolver.
  const myDrafts = (data?.myCompetitions ?? []).filter(
    (c) => c.status === "DRAFT",
  );
  // Round-61 — organizer-tracking rail: every competition the viewer runs
  // that's still in play (draft / upcoming / ongoing). Ordered most-
  // actionable first: live, then accepting/closed applications, then drafts.
  const YOUR_COMP_RANK: Record<string, number> = {
    ONGOING: 0,
    OPEN_FOR_APPLICATIONS: 1,
    APPLICATIONS_CLOSED: 2,
    DRAFT: 3,
  };
  const yourCompetitions = (data?.myCompetitions ?? [])
    .filter((c) => c.status in YOUR_COMP_RANK)
    .sort(
      (a, b) =>
        (YOUR_COMP_RANK[a.status] ?? 9) - (YOUR_COMP_RANK[b.status] ?? 9) ||
        bySoonestStart(a, b),
    );
  const greetingName = firstName(viewer?.name);

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 md:p-10">
      {/* Greeting — lime only for the welcome line; signed-out viewers get
          no heading here (the section titles below stand on their own).
          Create-competition CTA sits on the right since this is the only
          entry point from the dashboard. */}
      {viewer ? (
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-primary md:text-3xl">
              {greetingName
                ? `Welcome back, ${greetingName}!`
                : "Welcome to PoolDN"}
            </h1>
            <p className="text-sm text-muted-foreground">Ready to compete?</p>
          </div>
          <Link href="/competitions/new" data-testid="dashboard-create-comp">
            <Button variant="primary">
              <Plus className="size-4" />
              Create competition
            </Button>
          </Link>
        </header>
      ) : null}

      {/* Today's Match (or next scheduled). Hidden in the signed-out viewer
          dashboard — there's no "your card" when there's no viewer. */}
      {viewer && nextMatch ? <TodayMatchCard match={nextMatch} /> : null}

      {/* Round-57 — DRAFTs the viewer is organizing. Each row links to
          /competitions/{slug} which auto-redirects organizers into the
          4-tab setup editor, so a click resumes editing in one hop. */}
      {viewer && myDrafts.length > 0 ? (
        <section className="space-y-3" data-testid="dashboard-drafts">
          <SectionHeader title="Resume editing" />
          <div className="space-y-2.5">
            {myDrafts.slice(0, 3).map((c) => (
              <Link
                key={c.id}
                href={`/competitions/${c.slug}`}
                data-testid={`dashboard-draft-${c.slug}`}
                className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl"
              >
                <div className="flex items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/5 px-4 py-3 transition-colors hover:border-warning/70">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded bg-pink-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        Draft
                      </span>
                      <span className="truncate text-sm font-semibold">
                        {c.name}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      Pick up where you left off — Participants · Schedule
                      · Structure · Review &amp; Publish.
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    <Pencil className="size-3" />
                    Continue
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Round-61 — "Your Competitions": organizer rail tracking the
          viewer's draft, upcoming, and ongoing competitions in one place.
          Reuses the dashboard row card; ONGOING rows get the teal accent so
          live comps read the same as in the Active section below. */}
      {viewer && yourCompetitions.length > 0 ? (
        <section className="space-y-3" data-testid="dashboard-your-competitions">
          <SectionHeader
            title="Your Competitions"
            href="/competitions"
            showLink={yourCompetitions.length > 4}
          />
          <div className="space-y-2.5">
            {yourCompetitions.slice(0, 4).map((c) => (
              <CompetitionRowCard
                key={c.id}
                c={c}
                accent={c.status === "ONGOING" ? "active" : "muted"}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Upcoming Competitions — single column list. */}
      <section className="space-y-3" data-testid="dashboard-upcoming">
        <SectionHeader
          title="Upcoming Competitions"
          href="/competitions?status=OPEN_FOR_APPLICATIONS"
          showLink={upcoming.length > 0}
        />
        {upcoming.length === 0 ? (
          <EmptyMessage>
            No competitions are accepting applications right now.
          </EmptyMessage>
        ) : (
          <div className="space-y-2.5">
            {upcoming.slice(0, 3).map((c) => (
              <CompetitionRowCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </section>

      {/* Active Competitions — teal-tinted rows so they read as live. */}
      <section className="space-y-3" data-testid="dashboard-active">
        <SectionHeader
          title="Active Competitions"
          href="/competitions?status=ONGOING"
          showLink={active.length > 0}
        />
        {active.length === 0 ? (
          <EmptyMessage>No active competitions yet.</EmptyMessage>
        ) : (
          <div className="space-y-2.5">
            {active.slice(0, 3).map((c) => (
              <CompetitionRowCard key={c.id} c={c} accent="active" />
            ))}
          </div>
        )}
      </section>

      {/* Following */}
      {viewer && hasFollowing ? (
        <section className="space-y-3" data-testid="dashboard-following">
          <SectionHeader title="Following" />
          {followedComps.length > 0 ? (
            <div className="space-y-2.5">
              {followedComps.slice(0, 3).map((c) => (
                <CompetitionRowCard key={c.id} c={c} />
              ))}
            </div>
          ) : null}
          {followedTeams.length > 0 ? (
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              {followedTeams.slice(0, 6).map((t) => (
                <Link
                  key={t.id}
                  href={`/teams/${t.slug}`}
                  data-testid={`followed-team-${t.slug}`}
                >
                  <Card className="transition-colors hover:border-primary/40">
                    <CardContent className="flex items-center gap-3 py-3">
                      <Avatar
                        size="sm"
                        src={t.logoUrl ?? undefined}
                        fallback={t.name}
                        shape="team"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">
                          {t.name}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          @{t.captain.username} · {t.members.length} member
                          {t.members.length === 1 ? "" : "s"}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function SectionHeader({
  title,
  href,
  showLink = true,
}: {
  title: string;
  href?: string;
  showLink?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {href && showLink ? (
        <Link
          href={href}
          className="text-xs font-semibold text-primary hover:underline"
        >
          View All
        </Link>
      ) : null}
    </div>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
      {children}
    </p>
  );
}
