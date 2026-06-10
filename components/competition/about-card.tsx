import Link from "next/link";
import {
  Calendar,
  CalendarClock,
  ExternalLink,
  Home,
  Info,
  Lock,
  MapPin,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { LocalDateTime } from "@/components/ui/local-datetime";

/**
 * Round-48 — "About this competition" card surfacing the apply-relevant
 * configuration (type, rules, dates, weekdays, venues, application mode)
 * BEFORE a captain/player heads to the apply form. Shown prominently on
 * the overview page so people can evaluate the comp at a glance.
 */
export type AboutCardCompetition = {
  type: string;
  format: string;
  gameType: string;
  startDate?: string | null;
  endDate?: string | null;
  raceToFrames: number;
  minPlayersPerTeam: number;
  maxPlayersPerTeam?: number | null;
  minTeams: number;
  maxTeams?: number | null;
  breakAndRunRule: boolean;
  requiresHomeVenue: boolean;
  applicationMode: string;
  matchVenueMode: string;
  gamesPerOpponent: number;
  weekdaySchedule?: Array<{ weekday: number; time: string }> | null;
  rulesUrl?: string | null;
  city?: { name: string } | null;
};

const WEEKDAY_LABEL: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

function formatTime12(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const hr = Number(m[1]);
  const mins = m[2];
  const period = hr >= 12 ? "PM" : "AM";
  const h12 = hr % 12 === 0 ? 12 : hr % 12;
  return `${h12}:${mins} ${period}`;
}

function humanizeType(t: string): string {
  // TEAMS → Teams; SINGLES → Singles; SCOTCH_DOUBLES → Scotch Doubles
  return t
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function humanizeFormat(f: string): string {
  return humanizeType(f);
}

function humanizeGame(g: string): string {
  // EIGHT_BALL → 8-Ball, NINE_BALL → 9-Ball, TEN_BALL → 10-Ball
  switch (g) {
    case "EIGHT_BALL":
      return "8-Ball";
    case "NINE_BALL":
      return "9-Ball";
    case "TEN_BALL":
      return "10-Ball";
    case "STRAIGHT_POOL":
      return "Straight Pool";
    default:
      return humanizeType(g);
  }
}

export function AboutCard({ c }: { c: AboutCardCompetition }) {
  const slots = c.weekdaySchedule ?? [];
  return (
    <section
      className="rounded-xl border border-border bg-card/50 p-6"
      data-testid="competition-about-card"
    >
      <div className="mb-4 flex items-center gap-2">
        <Info className="size-4 text-primary" aria-hidden />
        <h2 className="text-base font-semibold">About this competition</h2>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
        <Row
          icon={<Trophy />}
          label="Format"
          value={`${humanizeFormat(c.format)} · ${humanizeGame(c.gameType)} · ${humanizeType(c.type)}`}
        />
        <Row
          icon={<Calendar />}
          label="Season"
          value={
            c.startDate ? (
              <>
                <LocalDateTime value={c.startDate} variant="date" />
                {c.endDate ? (
                  <>
                    {" – "}
                    <LocalDateTime value={c.endDate} variant="date" />
                  </>
                ) : null}
              </>
            ) : (
              "TBD"
            )
          }
        />
        {slots.length > 0 ? (
          <Row
            icon={<CalendarClock />}
            label="Days"
            value={slots
              .map((s) => `${WEEKDAY_LABEL[s.weekday] ?? "—"} ${formatTime12(s.time)}`)
              .join(" · ")}
          />
        ) : null}
        <Row
          icon={<Users />}
          label="Teams"
          value={`${c.minTeams}${c.maxTeams ? ` – ${c.maxTeams}` : "+"}`}
        />
        <Row
          icon={<Users />}
          label="Roster size"
          value={`${c.minPlayersPerTeam}${
            c.maxPlayersPerTeam ? ` – ${c.maxPlayersPerTeam}` : "+"
          } players`}
        />
        <Row
          icon={<Sparkles />}
          label="Race to"
          value={`${c.raceToFrames} frames per match`}
        />
        <Row
          icon={<Sparkles />}
          label="Games per opponent"
          value={c.gamesPerOpponent >= 2 ? "Home & Away" : "Only Once"}
        />
        <Row
          icon={<MapPin />}
          label="Where matches are played"
          value={
            c.matchVenueMode === "CENTRAL_VENUE"
              ? "Central venue"
              : "Team home venues"
          }
        />
        {c.city ? <Row icon={<MapPin />} label="City" value={c.city.name} /> : null}
        <Row
          icon={<Lock />}
          label="How to apply"
          value={c.applicationMode === "INVITE_ONLY" ? "Invite only" : "Any team can apply"}
        />
        {c.requiresHomeVenue ? (
          <Row
            icon={<Home />}
            label="Home venue"
            value="Required to apply"
          />
        ) : null}
        {c.breakAndRunRule ? (
          <Row
            icon={<Sparkles />}
            label="Break & Run"
            value="ON — running the rack wins the frame"
          />
        ) : null}
        {c.rulesUrl ? (
          <Row
            icon={<ExternalLink />}
            label="Rules"
            value={
              <Link
                href={c.rulesUrl}
                target="_blank"
                rel="noopener"
                className="text-primary hover:underline"
              >
                Read the full rules
              </Link>
            }
          />
        ) : null}
      </dl>
    </section>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary [&>svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </dt>
        <dd className="text-sm font-medium">{value}</dd>
      </div>
    </div>
  );
}
