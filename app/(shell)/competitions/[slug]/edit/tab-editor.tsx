"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  Calendar,
  Check,
  Coffee,
  GripVertical,
  Info,
  Plus,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  PublishCompetitionMutation,
  UpdateCompetitionMutation,
} from "@/lib/graphql/operations/competition-mutations.operations";
import { VenuesListQuery } from "@/lib/graphql/operations/venue.operations";

/**
 * Round-51 — Figma-faithful draft competition editor.
 *
 * After a captain creates a DRAFT on /competitions/new, they land here.
 * Four labeled tabs (Participants · Schedule · Structure · Review &
 * Publish) walk through the remaining setup. Each tab is its own card
 * with segmented toggles, a confirmation summary, and a Save button
 * that posts only the fields it owns and advances to the next tab.
 */

type Block = {
  id: string;
  type: "SINGLES" | "DOUBLES" | "SCOTCH_DOUBLES";
  games: number;
  raceTo: number | null;
  breakAfterMin: number | null;
};

type WeekdaySlot = { weekday: number; time: string };

type CompetitionInitial = {
  id: string;
  slug: string;
  name: string;
  status: string;
  format: string;
  gameType: string;
  type: string;
  startDate: string | null;
  prizePool: string | null;
  currency: string | null;
  minTeams: number;
  maxTeams: number | null;
  minPlayersPerTeam: number;
  maxPlayersPerTeam: number | null;
  applicationMode: "OPEN" | "INVITE_ONLY";
  matchVenueMode: "TEAM_VENUES" | "CENTRAL_VENUE";
  centralVenueId: string | null;
  gamesPerOpponent: number;
  schedulingType: string | null;
  weekdaySchedule: WeekdaySlot[];
  fixedMatchDates: string[];
  blocks: Array<{
    type: string;
    games: number;
    raceTo: number | null;
    breakAfterMin: number | null;
  }>;
};

type TabKey = "participants" | "schedule" | "structure" | "review";

const TABS: { key: TabKey; label: string }[] = [
  { key: "participants", label: "Participants" },
  { key: "schedule", label: "Schedule" },
  { key: "structure", label: "Structure" },
  { key: "review", label: "Review & Publish" },
];

// Match Date.getDay(): Sunday=0 … Saturday=6 — same convention the server
// already uses in weekdaySchedule (see lib/graphql/types/competition.ts).
const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const HOURS_OPTIONS = (() => {
  const out: string[] = [];
  for (let h = 8; h <= 23; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out;
})();

const GAME_LABEL: Record<string, string> = {
  EIGHT_BALL: "8-ball",
  NINE_BALL: "9-ball",
  TEN_BALL: "10-ball",
  STRAIGHT_POOL: "Straight pool",
};

const FORMAT_LABEL: Record<string, string> = {
  ROUND_ROBIN: "Round Robin / League",
  SINGLE_ELIMINATION: "Single Elimination",
  DOUBLE_ELIMINATION: "Double Elimination",
  SWISS: "Swiss",
};

export function TabEditor({ initial }: { initial: CompetitionInitial }) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<TabKey>("participants");

  // Local working copy — each tab mutates its slice; on Save we POST and
  // refresh server state. Keeps each tab independent and avoids the
  // long-form react-hook-form rebuild for an essentially short flow.
  const [data, setData] = useState<CompetitionInitial>({ ...initial });

  const [updateMutation, { loading: saving }] = useMutation(
    UpdateCompetitionMutation,
  );
  const [publishMutation, { loading: publishing }] = useMutation(
    PublishCompetitionMutation,
  );

  function set<K extends keyof CompetitionInitial>(
    key: K,
    value: CompetitionInitial[K],
  ) {
    setData((d) => ({ ...d, [key]: value }));
  }

  async function save(
    patch: Partial<CompetitionInitial>,
    successMessage: string,
    nextTab?: TabKey,
  ) {
    try {
      await updateMutation({
        variables: {
          id: data.id,
          input: {
            applicationMode: patch.applicationMode,
            maxTeams: patch.maxTeams,
            minPlayersPerTeam: patch.minPlayersPerTeam,
            maxPlayersPerTeam: patch.maxPlayersPerTeam,
            matchVenueMode: patch.matchVenueMode,
            centralVenueId: patch.centralVenueId,
            gamesPerOpponent: patch.gamesPerOpponent,
            schedulingType: patch.schedulingType,
            weekdaySchedule: patch.weekdaySchedule,
            fixedMatchDates: patch.fixedMatchDates,
            blocks: patch.blocks?.map((b) => ({
              type: b.type as "SINGLES" | "DOUBLES" | "SCOTCH_DOUBLES",
              games: b.games,
              raceTo: b.raceTo ?? null,
              breakAfterMin: b.breakAfterMin ?? null,
            })),
          },
        },
      });
      toast.success(successMessage);
      router.refresh();
      if (nextTab) setTab(nextTab);
    } catch (e) {
      toast.error(
        "Could not save",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  async function publish() {
    try {
      await publishMutation({ variables: { id: data.id } });
      toast.success("Competition published");
      router.push(`/competitions/${data.slug}`);
      router.refresh();
    } catch (e) {
      toast.error(
        "Could not publish",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  return (
    <div className="min-h-full">
      {/* Title block — lime-tinted hero */}
      <header className="bg-primary/10 px-6 py-10 md:px-10">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-2xl font-semibold text-primary md:text-3xl">
            {data.name}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge color="pink">DRAFT</Badge>
            {data.type === "TEAMS" ? <Badge color="lime">Teams</Badge> : null}
            <span className="text-sm">
              {FORMAT_LABEL[data.format] ?? data.format}
            </span>
            <span>·</span>
            <span className="text-sm">
              {GAME_LABEL[data.gameType] ?? data.gameType}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {data.startDate ? (
              <span className="inline-flex items-center gap-1.5 text-primary">
                <Calendar className="size-4" />
                Starts{" "}
                {new Date(data.startDate).toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            ) : null}
            {data.prizePool ? (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Trophy className="size-4" />
                {data.prizePool} {data.currency ?? ""}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Users className="size-4" />
              0
            </span>
          </div>
        </div>
      </header>

      {/* Editor card */}
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-6">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {/* Tab list */}
          <div
            role="tablist"
            className="flex items-center gap-1 border-b border-border bg-secondary/30 p-2"
          >
            {TABS.map((t, i) => {
              const active = t.key === tab;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.key)}
                  data-active={active || undefined}
                  data-testid={`edit-tab-${t.key}`}
                  className={cn(
                    "flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                  )}
                >
                  <span className="mr-1.5 inline-flex size-5 items-center justify-center rounded-full border border-current text-[10px]">
                    {i + 1}
                  </span>
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="space-y-4 p-6">
            {tab === "participants" ? (
              <ParticipantsTab
                data={data}
                onChange={set}
                // Round-58 — the tab passes the (possibly defaulted) roster
                // values explicitly so a same-tick onChange + save can't
                // race React's async state update.
                onSave={(roster) =>
                  save(
                    {
                      applicationMode: data.applicationMode,
                      maxTeams: data.maxTeams,
                      minPlayersPerTeam: roster.minPlayersPerTeam,
                      maxPlayersPerTeam: roster.maxPlayersPerTeam,
                    },
                    "Participants saved",
                    "schedule",
                  )
                }
                saving={saving}
              />
            ) : null}
            {tab === "schedule" ? (
              <ScheduleTab
                data={data}
                onChange={set}
                onSave={() =>
                  save(
                    {
                      matchVenueMode: data.matchVenueMode,
                      centralVenueId: data.centralVenueId,
                      gamesPerOpponent: data.gamesPerOpponent,
                      schedulingType: data.schedulingType,
                      weekdaySchedule: data.weekdaySchedule,
                      fixedMatchDates: data.fixedMatchDates,
                    },
                    "Schedule saved",
                    "structure",
                  )
                }
                saving={saving}
              />
            ) : null}
            {tab === "structure" ? (
              <StructureTab
                data={data}
                onChange={set}
                onSave={() =>
                  save(
                    {
                      blocks: data.blocks.map((b, idx) => ({
                        ...b,
                        id: `b-${idx}`,
                      })) as unknown as Block[],
                    },
                    "Structure saved",
                    "review",
                  )
                }
                saving={saving}
              />
            ) : null}
            {tab === "review" ? (
              <ReviewTab
                data={data}
                onEdit={(k) => setTab(k)}
                onPublish={publish}
                publishing={publishing}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Participants tab
// ─────────────────────────────────────────────────────────────────────────

function ParticipantsTab({
  data,
  onChange,
  onSave,
  saving,
}: {
  data: CompetitionInitial;
  onChange: <K extends keyof CompetitionInitial>(
    k: K,
    v: CompetitionInitial[K],
  ) => void;
  onSave: (roster: {
    minPlayersPerTeam: number;
    maxPlayersPerTeam: number;
  }) => void;
  saving: boolean;
}) {
  // Round-58 — Figma defaults: roster 3–8. The Basics screen creates comps
  // with min=1 / max=null, so seed the friendly defaults the first time
  // this tab renders rather than showing a bare "1 — 1".
  const minPlayers = data.minPlayersPerTeam > 1 ? data.minPlayersPerTeam : 3;
  const maxPlayers = data.maxPlayersPerTeam ?? 8;
  const rosterInvalid = maxPlayers < minPlayers;

  const summary =
    `${data.applicationMode === "OPEN" ? "Any team can apply" : "Invite-only"}. ` +
    `Max ${data.maxTeams ?? "—"} participants. ` +
    `Team roster size ${minPlayers} to ${maxPlayers} players.`;

  return (
    <div className="space-y-5">
      <Field label="How Participants Apply?">
        <Segmented
          value={data.applicationMode}
          options={[
            { value: "OPEN", label: "Anyone Can Apply" },
            { value: "INVITE_ONLY", label: "Invite Only" },
          ]}
          onChange={(v) =>
            onChange("applicationMode", v as "OPEN" | "INVITE_ONLY")
          }
          testIdPrefix="participants-mode"
        />
      </Field>

      <Field label="Max Amount of Participants (Teams)">
        <input
          type="number"
          min={2}
          value={data.maxTeams ?? ""}
          onChange={(e) =>
            onChange(
              "maxTeams",
              e.target.value ? Number(e.target.value) : null,
            )
          }
          placeholder="24"
          className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          data-testid="participants-max-teams"
        />
      </Field>

      <Field label="Min and Max Amount of Players per Team (Roster)">
        <div className="flex items-stretch gap-2">
          <LabeledNumber
            label="Min"
            value={minPlayers}
            onChange={(n) => onChange("minPlayersPerTeam", Math.max(1, n))}
            testId="participants-min-players"
          />
          <span className="self-center text-muted-foreground">—</span>
          <LabeledNumber
            label="Max"
            value={maxPlayers}
            onChange={(n) => onChange("maxPlayersPerTeam", Math.max(1, n))}
            testId="participants-max-players"
          />
        </div>
        {rosterInvalid ? (
          <p
            className="mt-2 text-xs font-medium text-destructive"
            role="alert"
            data-testid="participants-roster-error"
          >
            Max players must be greater than or equal to Min ({minPlayers}).
          </p>
        ) : null}
      </Field>

      <SummaryBox text={summary} />

      <SaveButton
        loading={saving}
        disabled={rosterInvalid}
        onClick={() =>
          onSave({
            minPlayersPerTeam: minPlayers,
            maxPlayersPerTeam: maxPlayers,
          })
        }
      >
        Save and Continue
      </SaveButton>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Schedule tab
// ─────────────────────────────────────────────────────────────────────────

function ScheduleTab({
  data,
  onChange,
  onSave,
  saving,
}: {
  data: CompetitionInitial;
  onChange: <K extends keyof CompetitionInitial>(
    k: K,
    v: CompetitionInitial[K],
  ) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const schedulingType = data.schedulingType ?? "WEEKLY_ROUNDS";
  const isWeekly = schedulingType === "WEEKLY_ROUNDS";
  const isCentral = data.matchVenueMode === "CENTRAL_VENUE";

  // Round-58 — venues list for the Central Venue dropdown. cache-first:
  // the list barely changes within an editing session.
  const venuesQuery = useQuery(VenuesListQuery, {
    fetchPolicy: "cache-first",
    errorPolicy: "ignore",
    skip: !isCentral,
  });
  const venues = (venuesQuery.data?.venues ?? []).filter((v) => v.isActive);
  const centralVenue = venues.find((v) => v.id === data.centralVenueId) ?? null;

  function addWeekday() {
    const used = new Set(data.weekdaySchedule.map((w) => w.weekday));
    const free = WEEKDAYS.findIndex((_, i) => !used.has(i));
    onChange("weekdaySchedule", [
      ...data.weekdaySchedule,
      { weekday: free === -1 ? 6 : free, time: "21:00" },
    ]);
  }
  function removeSlot(idx: number) {
    onChange(
      "weekdaySchedule",
      data.weekdaySchedule.filter((_, i) => i !== idx),
    );
  }
  function patchSlot(idx: number, patch: Partial<WeekdaySlot>) {
    onChange(
      "weekdaySchedule",
      data.weekdaySchedule.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    );
  }

  // Round-58 — Fixed Match Day(s) date list helpers.
  function addFixedDate() {
    // Default the new row to the day after the latest picked date (or
    // tomorrow when the list is empty) so consecutive adds don't collide.
    const last = data.fixedMatchDates[data.fixedMatchDates.length - 1];
    const base = last ? new Date(`${last}T00:00:00`) : new Date();
    base.setDate(base.getDate() + 1);
    const iso = base.toISOString().slice(0, 10);
    onChange("fixedMatchDates", [...data.fixedMatchDates, iso]);
  }
  function patchFixedDate(idx: number, value: string) {
    onChange(
      "fixedMatchDates",
      data.fixedMatchDates.map((d, i) => (i === idx ? value : d)),
    );
  }
  function removeFixedDate(idx: number) {
    onChange(
      "fixedMatchDates",
      data.fixedMatchDates.filter((_, i) => i !== idx),
    );
  }

  const venueSentence =
    data.matchVenueMode === "TEAM_VENUES"
      ? "Teams will have games in their home venues"
      : centralVenue
        ? `All matches will be played at ${centralVenue.name}`
        : "Pick the central venue all matches will be played at";
  const oppSentence =
    data.gamesPerOpponent >= 2
      ? "Each team plays twice (home & away) against every other team"
      : "Each team plays each opponent once";
  const scheduleSentence = isWeekly
    ? data.weekdaySchedule.length > 0
      ? `Games will happen ${data.weekdaySchedule
          .map((s) => `every ${WEEKDAYS[s.weekday] ?? "?"} at ${s.time}`)
          .join(" and ")}`
      : "Pick the weekdays games will run on"
    : data.fixedMatchDates.length > 0
      ? `Matches run on ${data.fixedMatchDates.length} fixed day${data.fixedMatchDates.length === 1 ? "" : "s"}: ${data.fixedMatchDates.join(", ")}`
      : "Pick the specific dates matches will run on";

  return (
    <div className="space-y-5">
      <Field label="Where Matches Are Played?">
        <Segmented
          value={data.matchVenueMode}
          options={[
            { value: "TEAM_VENUES", label: "Team Venues" },
            { value: "CENTRAL_VENUE", label: "Central Venue" },
          ]}
          onChange={(v) =>
            onChange(
              "matchVenueMode",
              v as "TEAM_VENUES" | "CENTRAL_VENUE",
            )
          }
          testIdPrefix="schedule-venue"
        />
        {isCentral ? (
          <select
            value={data.centralVenueId ?? ""}
            onChange={(e) =>
              onChange("centralVenueId", e.target.value || null)
            }
            className="mt-3 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            data-testid="schedule-central-venue"
          >
            <option value="">
              {venuesQuery.loading ? "Loading venues…" : "Select a venue…"}
            </option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.city ? ` · ${v.city.name}` : ""}
                {v.tableCount ? ` · ${v.tableCount} tables` : ""}
              </option>
            ))}
          </select>
        ) : null}
        <InlineNote>{venueSentence}</InlineNote>
      </Field>

      <Field label="Games per Opponent">
        <Segmented
          value={data.gamesPerOpponent >= 2 ? "2" : "1"}
          options={[
            { value: "2", label: "Home & Away" },
            { value: "1", label: "Only Once" },
          ]}
          onChange={(v) =>
            onChange("gamesPerOpponent", v === "2" ? 2 : 1)
          }
          testIdPrefix="schedule-opp"
        />
        <InlineNote>{oppSentence}</InlineNote>
      </Field>

      <Field label="Scheduling Type">
        <Segmented
          value={schedulingType}
          options={[
            { value: "WEEKLY_ROUNDS", label: "Weekly Rounds" },
            { value: "FIXED_MATCHDAYS", label: "Fixed Match Day(s)" },
          ]}
          onChange={(v) => onChange("schedulingType", v)}
          testIdPrefix="schedule-type"
        />
        {isWeekly ? (
          <div className="mt-3 space-y-2 rounded-md border border-border bg-background p-3">
            {data.weekdaySchedule.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Add the weekdays games will run on.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.weekdaySchedule.map((slot, idx) => (
                  <li
                    key={`${slot.weekday}-${idx}`}
                    className="flex items-center gap-3"
                  >
                    <span className="text-sm text-muted-foreground">Every</span>
                    <select
                      value={slot.weekday}
                      onChange={(e) =>
                        patchSlot(idx, { weekday: Number(e.target.value) })
                      }
                      className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    >
                      {WEEKDAYS.map((d, i) => (
                        <option key={d} value={i}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <span className="text-sm text-muted-foreground">at</span>
                    <select
                      value={slot.time}
                      onChange={(e) => patchSlot(idx, { time: e.target.value })}
                      className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    >
                      {HOURS_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeSlot(idx)}
                      aria-label="Remove weekday"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={addWeekday}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-primary/40 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/5"
              data-testid="schedule-add-weekday"
            >
              <Plus className="size-4" />
              Add Weekday
            </button>
          </div>
        ) : (
          /* Round-58 — Fixed Match Day(s): explicit per-date rows. */
          <div className="mt-3 space-y-2 rounded-md border border-border bg-background p-3">
            {data.fixedMatchDates.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Add the specific dates matches will run on.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.fixedMatchDates.map((date, idx) => (
                  <li key={`${date}-${idx}`} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      Match day {idx + 1}
                    </span>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => patchFixedDate(idx, e.target.value)}
                      className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm [color-scheme:dark]"
                      data-testid={`schedule-fixed-date-${idx}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeFixedDate(idx)}
                      aria-label="Remove date"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={addFixedDate}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-primary/40 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/5"
              data-testid="schedule-add-fixed-date"
            >
              <Plus className="size-4" />
              Add Match Day
            </button>
          </div>
        )}
      </Field>

      <SummaryBox
        items={[
          venueSentence,
          oppSentence,
          scheduleSentence,
          "Season Calendar will be generated after teams confirmed",
        ]}
      />

      <SaveButton loading={saving} onClick={onSave}>
        Save Schedule Settings
      </SaveButton>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Structure tab
// ─────────────────────────────────────────────────────────────────────────

const BLOCK_LABEL: Record<string, string> = {
  SINGLES: "Singles Game (1 vs 1)",
  DOUBLES: "Doubles Game (2 vs 2)",
  SCOTCH_DOUBLES: "Scotch Doubles",
};

function StructureTab({
  data,
  onChange,
  onSave,
  saving,
}: {
  data: CompetitionInitial;
  onChange: <K extends keyof CompetitionInitial>(
    k: K,
    v: CompetitionInitial[K],
  ) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const blocks = data.blocks;

  function add(type: Block["type"]) {
    onChange("blocks", [
      ...blocks,
      { type, games: 1, raceTo: 5, breakAfterMin: null },
    ] as unknown as CompetitionInitial["blocks"]);
  }
  function remove(idx: number) {
    onChange(
      "blocks",
      blocks.filter((_, i) => i !== idx),
    );
  }
  function move(idx: number, dir: -1 | 1) {
    const tgt = idx + dir;
    if (tgt < 0 || tgt >= blocks.length) return;
    const next = [...blocks];
    [next[idx], next[tgt]] = [next[tgt], next[idx]];
    onChange("blocks", next);
  }
  function patch(idx: number, p: Partial<Block>) {
    onChange(
      "blocks",
      blocks.map((b, i) => (i === idx ? { ...b, ...p } : b)),
    );
  }

  const singles = blocks
    .filter((b) => b.type === "SINGLES")
    .reduce((a, b) => a + (b.games || 0), 0);
  const doubles = blocks
    .filter((b) => b.type === "DOUBLES" || b.type === "SCOTCH_DOUBLES")
    .reduce((a, b) => a + (b.games || 0), 0);
  const breaks = blocks.filter((b) => b.breakAfterMin).length;
  const total = singles + doubles;

  return (
    <div className="space-y-5">
      <div>
        <div className="text-sm font-semibold">
          Build your match layout by adding game blocks
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Drag &amp; drop to reorder match layout
        </p>
      </div>

      <ul
        className="space-y-1.5 rounded-md border border-border bg-background p-3"
        data-testid="structure-block-list"
      >
        {blocks.length === 0 ? (
          <li className="py-4 text-center text-xs text-muted-foreground">
            No blocks yet — add at least one Singles or Doubles below.
          </li>
        ) : (
          blocks.map((b, idx) => (
            <li
              key={idx}
              className="space-y-1.5 rounded-md border border-border px-3 py-2"
              data-testid={`structure-block-${idx}`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  aria-label="Move up"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <GripVertical className="size-4" />
                </button>
                <span className="w-6 text-center font-mono text-xs font-bold text-muted-foreground">
                  {idx + 1}
                </span>
                <span className="text-sm font-semibold">
                  {BLOCK_LABEL[b.type]}
                </span>
                <span className="text-xs text-muted-foreground">games</span>
                <input
                  type="number"
                  min={1}
                  value={b.games}
                  onChange={(e) =>
                    patch(idx, { games: Math.max(1, Number(e.target.value)) })
                  }
                  className="w-14 rounded-md border border-border bg-background px-2 py-1 text-sm"
                />
                <span className="text-xs text-muted-foreground">race to</span>
                <input
                  type="number"
                  min={1}
                  value={b.raceTo ?? 5}
                  onChange={(e) =>
                    patch(idx, {
                      raceTo: Math.max(1, Number(e.target.value)),
                    })
                  }
                  className="w-14 rounded-md border border-border bg-background px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  aria-label="Remove block"
                  className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
              {/* Break-after — Figma's standalone "Break Time" rows map to
                  breakAfterMin on the preceding block in this schema.
                  Surfaced inline so the captain can express the same shape. */}
              <div className="flex flex-wrap items-center gap-2 pl-9 text-xs">
                <label className="inline-flex items-center gap-1 text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={!!b.breakAfterMin}
                    onChange={(e) =>
                      patch(idx, {
                        breakAfterMin: e.target.checked ? 10 : null,
                      })
                    }
                    className="size-3 accent-primary"
                  />
                  <Coffee className="size-3" />
                  Break after this block
                </label>
                {b.breakAfterMin ? (
                  <>
                    <input
                      type="number"
                      min={1}
                      value={b.breakAfterMin}
                      onChange={(e) =>
                        patch(idx, {
                          breakAfterMin: Math.max(1, Number(e.target.value)),
                        })
                      }
                      className="w-14 rounded-md border border-border bg-background px-2 py-1 text-xs"
                    />
                    <span className="text-muted-foreground">minutes</span>
                  </>
                ) : null}
              </div>
            </li>
          ))
        )}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={() => add("SINGLES")}>
          <Plus className="size-4" />
          Singles
        </Button>
        <Button type="button" variant="outline" onClick={() => add("DOUBLES")}>
          <Plus className="size-4" />
          Doubles
        </Button>
      </div>

      <SummaryBox
        text={
          total > 0
            ? `Teams will play ${total} games per match: ${singles} singles and ${doubles} doubles. Team Captains will assign players before the match and/or during the breaks.` +
              (breaks > 0
                ? ` Match includes ${breaks} break${breaks === 1 ? "" : "s"}.`
                : "")
            : "Add Singles and/or Doubles blocks to define your match layout."
        }
      />

      <SaveButton
        loading={saving}
        onClick={onSave}
        disabled={total === 0}
      >
        Save Structure
      </SaveButton>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Review & Publish tab
// ─────────────────────────────────────────────────────────────────────────

function ReviewTab({
  data,
  onEdit,
  onPublish,
  publishing,
}: {
  data: CompetitionInitial;
  onEdit: (k: TabKey) => void;
  onPublish: () => void;
  publishing: boolean;
}) {
  const singles = data.blocks
    .filter((b) => b.type === "SINGLES")
    .reduce((a, b) => a + (b.games || 0), 0);
  const doubles = data.blocks
    .filter((b) => b.type === "DOUBLES" || b.type === "SCOTCH_DOUBLES")
    .reduce((a, b) => a + (b.games || 0), 0);
  const breaks = data.blocks.filter((b) => b.breakAfterMin).length;

  const isWeekly = (data.schedulingType ?? "WEEKLY_ROUNDS") === "WEEKLY_ROUNDS";
  const ready =
    !!data.maxTeams &&
    !!data.maxPlayersPerTeam &&
    (singles + doubles) > 0 &&
    (isWeekly
      ? data.weekdaySchedule.length > 0
      : data.fixedMatchDates.length > 0) &&
    // Round-58 — central-venue comps must actually have a venue picked.
    (data.matchVenueMode !== "CENTRAL_VENUE" || !!data.centralVenueId);

  return (
    <div className="space-y-4">
      <ReviewRow
        label="Participants"
        onEdit={() => onEdit("participants")}
        rows={[
          [
            "How Participants Apply",
            data.applicationMode === "OPEN" ? "Anyone Can Apply" : "Invite Only",
          ],
          ["Max Amount of Participants", String(data.maxTeams ?? "—")],
          [
            "Roster size",
            `${data.minPlayersPerTeam} – ${data.maxPlayersPerTeam ?? "—"}`,
          ],
        ]}
      />
      <ReviewRow
        label="Schedule"
        onEdit={() => onEdit("schedule")}
        rows={[
          [
            "Where Matches Are Played",
            data.matchVenueMode === "TEAM_VENUES" ? "Team Venues" : "Central Venue",
          ],
          [
            "Games per Opponent",
            data.gamesPerOpponent >= 2 ? "2 (Home & Away)" : "1 (Only Once)",
          ],
          [
            "Scheduling Type",
            (data.schedulingType ?? "WEEKLY_ROUNDS") === "WEEKLY_ROUNDS"
              ? "Weekly Rounds"
              : "Fixed Match Days",
          ],
          [
            "Match days",
            isWeekly
              ? data.weekdaySchedule.length
                ? data.weekdaySchedule
                    .map((s) => `${WEEKDAYS[s.weekday] ?? "?"} ${s.time}`)
                    .join(", ")
                : "—"
              : data.fixedMatchDates.length
                ? data.fixedMatchDates.join(", ")
                : "—",
          ],
        ]}
      />
      <ReviewRow
        label="Structure"
        onEdit={() => onEdit("structure")}
        rows={[
          [
            "Match Layout",
            `${singles + doubles} games (${singles} singles, ${doubles} doubles)` +
              (breaks ? `, ${breaks} break${breaks === 1 ? "" : "s"}` : ""),
          ],
        ]}
      />

      {!ready ? (
        <div className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          <Info className="mt-0.5 size-4 text-warning" />
          <div>
            <div className="font-semibold">Almost there</div>
            <p className="mt-0.5 text-xs">
              Fill in the participants, schedule, and structure tabs before
              publishing.
            </p>
          </div>
        </div>
      ) : null}

      <Button
        variant="primary"
        size="lg"
        loading={publishing}
        disabled={!ready}
        onClick={onPublish}
        className="w-full"
        data-testid="edit-publish"
      >
        <Check className="size-4" />
        Confirm &amp; Publish
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function Segmented({
  value,
  options,
  onChange,
  testIdPrefix,
}: {
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (v: string) => void;
  testIdPrefix: string;
}) {
  return (
    <div className="flex items-stretch gap-1 rounded-md border border-border bg-background p-1">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            data-active={active || undefined}
            data-testid={`${testIdPrefix}-${opt.value}`}
            className={cn(
              "flex-1 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary/50",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function LabeledNumber({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  testId?: string;
}) {
  return (
    <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-background p-1 pl-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(Math.max(1, Number(e.target.value || 1)))}
        className="w-full rounded-md bg-transparent px-2 py-1 text-center text-sm outline-none"
        data-testid={testId}
      />
    </div>
  );
}

function SummaryBox({
  text,
  items,
}: {
  text?: string;
  items?: string[];
}) {
  return (
    <div className="rounded-md border border-info/40 bg-info/10 p-3 text-sm text-info">
      {items ? (
        <ul className="list-disc space-y-1 pl-4 text-xs">
          {items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs">{text}</p>
      )}
    </div>
  );
}

function InlineNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 rounded-md bg-primary/10 px-3 py-2 text-xs text-primary">
      {children}
    </p>
  );
}

function SaveButton({
  children,
  onClick,
  loading,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  loading: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="primary"
      size="lg"
      loading={loading}
      disabled={disabled}
      onClick={onClick}
      className="w-full"
      data-testid="edit-save"
    >
      {children}
    </Button>
  );
}

function ReviewRow({
  label,
  rows,
  onEdit,
}: {
  label: string;
  rows: Array<[string, string]>;
  onEdit: () => void;
}) {
  return (
    <div className="rounded-md border border-border bg-background p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{label}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs font-semibold text-primary hover:underline"
        >
          Edit
        </button>
      </div>
      <dl className="grid grid-cols-1 gap-1 text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Badge({
  color,
  children,
}: {
  color: "pink" | "lime";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        color === "pink"
          ? "bg-pink-600 text-white"
          : "bg-primary text-primary-foreground",
      )}
    >
      {children}
    </span>
  );
}
