import Link from "next/link";
import type { ReactNode } from "react";
import { CountryFlag } from "@/components/ui/country-flag";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { getClient } from "@/lib/apollo/client";
import { CompetitionEditableQuery } from "@/lib/graphql/operations/competition.operations";

const NUM = new Intl.NumberFormat("en-US");

const GAME_LABEL: Record<string, string> = {
  EIGHT_BALL: "8-Ball",
  NINE_BALL: "9-Ball",
  TEN_BALL: "10-Ball",
  STRAIGHT_POOL: "Straight Pool",
};
const FORMAT_LABEL: Record<string, string> = {
  ROUND_ROBIN: "Round Robin / League",
  SINGLE_ELIMINATION: "Single Elimination",
  DOUBLE_ELIMINATION: "Double Elimination",
  SWISS: "Swiss",
};
const TYPE_LABEL: Record<string, string> = {
  TEAMS: "Teams",
  INDIVIDUAL: "Singles",
  DOUBLES: "Doubles",
};
const APP_MODE_LABEL: Record<string, string> = {
  OPEN: "Open",
  INVITE_ONLY: "Invite Only",
};
const VENUE_MODE_LABEL: Record<string, string> = {
  TEAM_VENUES: "Team Venues",
  CENTRAL_VENUE: "Central Venue",
};
const SCHED_LABEL: Record<string, string> = {
  WEEKLY_ROUNDS: "Weekly Rounds",
  FIXED_MATCHDAYS: "Fixed Matchdays",
  FLEXIBLE: "Flexible",
};
const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatTime(t: string): string {
  const [hStr, mStr] = t.split(":");
  let h = Number.parseInt(hStr ?? "0", 10);
  const m = mStr ?? "00";
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data } = await getClient().query({
    query: CompetitionEditableQuery,
    variables: { slug },
  });
  const c = data?.competition;
  if (!c) return null;

  const isIndividual = c.type === "INDIVIDUAL";
  const participantWord = isIndividual ? "Players" : "Teams";

  // Roster (team size) range — "3 - 10 players", or "3+ players".
  const rosterRange = `${c.minPlayersPerTeam}${
    c.maxPlayersPerTeam ? ` - ${c.maxPlayersPerTeam}` : "+"
  } players`;

  // Match layout summary from the ordered block list — "6 singles, 2 doubles,
  // 2 breaks".
  const blocks = [...c.blocks].sort((a, b) => a.order - b.order);
  let singles = 0;
  let doubles = 0;
  let breaks = 0;
  for (const b of blocks) {
    if (b.type === "SINGLES") singles += b.games;
    else doubles += b.games;
    if (b.breakAfterMin && b.breakAfterMin > 0) breaks += 1;
  }
  const layoutParts = [
    singles ? `${singles} singles` : null,
    doubles ? `${doubles} doubles` : null,
    breaks ? `${breaks} ${breaks === 1 ? "break" : "breaks"}` : null,
  ].filter(Boolean);
  const matchLayout = layoutParts.length > 0 ? layoutParts.join(", ") : "—";

  // Weekly matchday cadence — "Every Tuesday at 9:00 PM" per configured slot.
  const weekdaySlots = Array.isArray(c.weekdaySchedule)
    ? (c.weekdaySchedule as Array<{ weekday: number; time: string }>)
    : [];

  const gamesPerOpponent = c.gamesPerOpponent ?? 1;

  return (
    <div className="space-y-6">
      <Section title="Competition Details">
        <Row label="Name" value={c.name} />
        <Row
          label="Organizer"
          value={
            <Link
              href={`/players/${c.organizer.username}`}
              className="inline-flex items-center gap-1.5 hover:underline"
            >
              {c.organizer.name}
              <CountryFlag
                code={c.organizer.nationality}
                className="leading-none"
              />
            </Link>
          }
        />
        {c.description ? (
          <Row label="Description" value={c.description} />
        ) : null}
        <Row label="Type" value={FORMAT_LABEL[c.format] ?? c.format} />
        <Row label="Format" value={TYPE_LABEL[c.type] ?? c.type} />
        <Row label="Game Type" value={GAME_LABEL[c.gameType] ?? c.gameType} />
        <Row
          label="Competition Start Date"
          value={
            c.startDate ? (
              <LocalDateTime value={c.startDate} variant="date" />
            ) : (
              "TBD"
            )
          }
        />
        <Row
          label="Prize"
          value={
            c.prizePool
              ? `${NUM.format(Number(c.prizePool))} ${c.currency}`
              : "—"
          }
        />
      </Section>

      <Section title="Participants">
        <Row
          label="Application Mode"
          value={APP_MODE_LABEL[c.applicationMode] ?? c.applicationMode}
        />
        <Row
          label="Max Amount of Participants"
          value={c.maxTeams ?? "Unlimited"}
        />
        {!isIndividual ? (
          <Row label="Team Size (Roster)" value={rosterRange} />
        ) : null}
      </Section>

      <Section title="Schedule">
        <Row
          label="Where Matches Are Played"
          value={
            c.matchVenueMode === "CENTRAL_VENUE" && c.centralVenue
              ? c.centralVenue.name
              : VENUE_MODE_LABEL[c.matchVenueMode] ?? c.matchVenueMode
          }
        />
        <Row
          label="Games per Opponent"
          value={`${gamesPerOpponent} (${
            gamesPerOpponent >= 2 ? "Home & Away" : "Only Once"
          })`}
        />
        <Row
          label="Scheduling Type"
          value={SCHED_LABEL[c.schedulingType] ?? c.schedulingType}
        />
        <Row
          label="Matchdays"
          value={
            weekdaySlots.length > 0 ? (
              <div className="space-y-0.5">
                {weekdaySlots.map((s, i) => (
                  <div key={`${s.weekday}-${i}`}>
                    Every {WEEKDAYS[s.weekday] ?? "?"} at {formatTime(s.time)}
                  </div>
                ))}
              </div>
            ) : (
              "TBD"
            )
          }
        />
      </Section>

      <Section title="Structure">
        <Row label="Match Layout" value={matchLayout} />
        <Row
          label="Max Amount of Participants"
          value={
            c.maxTeams ? `${c.maxTeams} ${participantWord}` : "Unlimited"
          }
        />
        {!isIndividual ? (
          <Row label="Team Size (Roster)" value={rosterRange} />
        ) : null}
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      className="overflow-hidden rounded-xl border border-border bg-card"
      data-testid={`about-section-${title}`}
    >
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-primary">{title}</h2>
      </div>
      <dl className="px-4">{children}</dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border/60 py-3 last:border-0">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium">{value}</dd>
    </div>
  );
}
