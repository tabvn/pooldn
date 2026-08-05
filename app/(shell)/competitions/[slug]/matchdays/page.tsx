import { GenerateMatchdaysButton } from "@/components/competition/generate-matchdays-button";
import { SeasonCalendarCta } from "@/components/competition/season-calendar-cta";
import {
  MatchdayList,
  type MatchdayView,
} from "@/components/competition/matchday-list";
import { PoolhubIcon } from "@/components/layout/sidebar-icons";
import { getClient } from "@/lib/apollo/client";
import {
  CompetitionHeaderQuery,
  CompetitionMatchdaysQuery,
  ViewerQuery,
} from "@/lib/graphql/operations/competition.operations";

export default async function MatchdaysPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = getClient();
  const [matchdaysRes, headerRes, viewerRes] = await Promise.all([
    client.query({ query: CompetitionMatchdaysQuery, variables: { slug } }),
    client.query({ query: CompetitionHeaderQuery, variables: { slug } }),
    client.query({ query: ViewerQuery, errorPolicy: "ignore" }),
  ]);
  const c = matchdaysRes.data?.competition;
  const header = headerRes.data?.competition;
  const viewer = viewerRes.data?.viewer ?? null;
  if (!c || !header) return null;

  const isAdmin = viewer?.role === "SUPER_ADMIN";
  const owns = !!viewer && viewer.id === header.organizer.id;
  const canManage = isAdmin || owns;

  const preStart =
    header.status === "OPEN_FOR_APPLICATIONS" ||
    header.status === "APPLICATIONS_CLOSED";

  if (c.matchdays.length === 0) {
    // Round-61 — Figma "Season Calendar" empty state (node 299:9670). Before
    // the season is generated the Matchdays tab leads with the brand mark, an
    // explainer, and the close-and-generate CTA (organizer only).
    if (preStart) {
      return (
        <div className="flex flex-col items-center gap-5 rounded-[10px] border border-border bg-card px-5 py-10">
          <div className="rounded-full bg-primary p-2 drop-shadow-[2px_2px_6px_rgba(208,243,13,0.5)]">
            <PoolhubIcon className="size-11 text-background" />
          </div>
          <div className="flex w-full flex-col items-center gap-5">
            <h2 className="text-center text-xl font-semibold text-foreground">
              Season Calendar
            </h2>
            <div className="w-full rounded-lg border border-[#00598a] bg-[#052f4a] p-3 text-center text-sm leading-5 text-[#dff2fe]">
              {canManage ? (
                <>
                  <p>To generate season calendar you need to close applications.</p>
                  <p>
                    Unaccepted invites and applications will be automatically
                    rejected.
                  </p>
                  <p>
                    Matchdays will be generated based on confirmed teams. You
                    won&rsquo;t be able to invite or accept new participants.
                  </p>
                </>
              ) : (
                <p>
                  The season schedule hasn&rsquo;t been published yet. Matchdays
                  will appear here once the organizer generates the calendar.
                </p>
              )}
            </div>
          </div>
          {canManage ? (
            <SeasonCalendarCta
              competitionId={header.id}
              status={header.status}
              format={header.format}
              approvedTeamCount={header.approvedTeamCount}
            />
          ) : null}
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          No matchdays have been generated yet.
        </p>
        {canManage ? (
          <GenerateMatchdaysButton competitionId={header.id} />
        ) : null}
      </div>
    );
  }

  // Derive each matchday's lifecycle state for the Figma header tones /
  // badges. A match is "resolved" once it's COMPLETED/CANCELLED or a bye
  // (one side missing). A matchday is Past when every match is resolved;
  // the earliest unresolved matchday is the Current one; the rest are
  // Scheduled. A COMPLETED competition has no Current marker.
  const ordered = [...c.matchdays].sort((a, b) => a.number - b.number);
  const resolved = (m: (typeof ordered)[number]["matches"][number]) =>
    m.status === "COMPLETED" ||
    m.status === "CANCELLED" ||
    !m.homeTeam ||
    !m.awayTeam;
  const firstUnresolvedIdx =
    header.status === "COMPLETED"
      ? -1
      : ordered.findIndex((md) => !md.matches.every(resolved));

  // Every team that appears anywhere in the schedule — a round robin plays
  // them all, so this is the full field. A team missing from a given
  // matchday's matches is on a bye that day.
  const allTeamsBySlug = new Map<
    string,
    { name: string; slug: string; logoUrl: string | null }
  >();
  for (const md of ordered) {
    for (const m of md.matches) {
      for (const t of [m.homeTeam, m.awayTeam]) {
        if (t) {
          allTeamsBySlug.set(t.slug, {
            name: t.name,
            slug: t.slug,
            logoUrl: t.logoUrl ?? null,
          });
        }
      }
    }
  }

  const matchdays: MatchdayView[] = ordered.map((md, idx) => {
    const playing = new Set<string>();
    for (const m of md.matches) {
      if (m.homeTeam) playing.add(m.homeTeam.slug);
      if (m.awayTeam) playing.add(m.awayTeam.slug);
    }
    const byes = [...allTeamsBySlug.values()].filter(
      (t) => !playing.has(t.slug),
    );
    return {
      id: md.id,
      number: md.number,
      label: md.label ?? null,
      note: md.note ?? null,
      scheduledDate: md.scheduledDate ?? null,
      state: (idx === firstUnresolvedIdx
        ? "current"
        : firstUnresolvedIdx === -1 || idx < firstUnresolvedIdx
          ? "past"
          : "scheduled") as MatchdayView["state"],
      byes,
      matches: md.matches.map((m) => ({
      id: m.id,
      status: m.status,
      homeScore: m.homeScore ?? null,
      awayScore: m.awayScore ?? null,
      home: m.homeTeam
        ? { name: m.homeTeam.name, slug: m.homeTeam.slug, logoUrl: m.homeTeam.logoUrl }
        : null,
      away: m.awayTeam
        ? { name: m.awayTeam.name, slug: m.awayTeam.slug, logoUrl: m.awayTeam.logoUrl }
        : null,
      venueName: m.venue?.name ?? null,
      })),
    };
  });

  return <MatchdayList matchdays={matchdays} canManage={canManage} />;
}
