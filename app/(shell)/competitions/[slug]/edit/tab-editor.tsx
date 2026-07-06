"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Calendar,
  Check,
  Coffee,
  GripVertical,
  Info,
  Plus,
  Trophy,
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
  description: string | null;
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

type TabKey = "details" | "participants" | "schedule" | "structure" | "review";

const TABS: { key: TabKey; label: string }[] = [
  { key: "details", label: "Details" },
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

export function TabEditor({
  initial,
  initialTab,
}: {
  initial: CompetitionInitial;
  /** Which tab to open on. Defaults to "details"; the create flow passes
   *  "participants" so newly-created comps continue setup there. */
  initialTab?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<TabKey>(
    TABS.some((t) => t.key === initialTab)
      ? (initialTab as TabKey)
      : "details",
  );

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
            name: patch.name,
            description:
              patch.description === undefined ? undefined : patch.description,
            startDate:
              patch.startDate === undefined ? undefined : patch.startDate,
            prizePool:
              patch.prizePool === undefined ? undefined : patch.prizePool,
            currency: patch.currency,
            applicationMode: patch.applicationMode,
            maxTeams: patch.maxTeams,
            minPlayersPerTeam: patch.minPlayersPerTeam,
            maxPlayersPerTeam: patch.maxPlayersPerTeam,
            matchVenueMode: patch.matchVenueMode,
            centralVenueId: patch.centralVenueId,
            gamesPerOpponent: patch.gamesPerOpponent,
            schedulingType: patch.schedulingType,
            // Strip Apollo's __typename — the slots come straight off the
            // CompetitionEditableQuery result, and WeekdaySlotInput only
            // accepts { weekday, time }.
            weekdaySchedule: patch.weekdaySchedule?.map((s) => ({
              weekday: s.weekday,
              time: s.time,
            })),
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
            {tab === "details" ? (
              <DetailsTab
                data={data}
                onChange={set}
                onSave={() =>
                  save(
                    {
                      name: data.name,
                      description: data.description,
                      startDate: data.startDate,
                      prizePool: data.prizePool,
                      currency: data.currency,
                    },
                    "Details saved",
                    "participants",
                  )
                }
                saving={saving}
              />
            ) : null}
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
                      maxTeams: roster.maxTeams,
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
// Details tab — name, description, start date, prize
// ─────────────────────────────────────────────────────────────────────────

function DetailsTab({
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
  // startDate is stored as a full ISO DateTime; the date input only handles
  // the calendar day, so slice on read and re-stamp midnight on write.
  const startDay = data.startDate ? data.startDate.slice(0, 10) : "";
  const nameInvalid = data.name.trim().length === 0;

  return (
    <div className="space-y-5">
      <Field label="Competition Name">
        <input
          type="text"
          value={data.name}
          onChange={(e) => onChange("name", e.target.value)}
          className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          data-testid="details-name"
        />
        {nameInvalid ? (
          <p
            className="mt-2 text-xs font-medium text-destructive"
            role="alert"
            data-testid="details-name-error"
          >
            Name can&apos;t be empty.
          </p>
        ) : null}
      </Field>

      <Field label="Description">
        <textarea
          value={data.description ?? ""}
          onChange={(e) =>
            onChange("description", e.target.value ? e.target.value : null)
          }
          rows={4}
          placeholder="Tell teams what this competition is about…"
          className="block w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          data-testid="details-description"
        />
      </Field>

      <Field label="Start Date">
        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3">
          <Calendar className="size-4 text-muted-foreground" />
          <input
            type="date"
            value={startDay}
            onChange={(e) =>
              onChange(
                "startDate",
                e.target.value
                  ? new Date(`${e.target.value}T00:00:00`).toISOString()
                  : null,
              )
            }
            className="block w-full bg-transparent py-2 text-sm outline-none"
            data-testid="details-start-date"
          />
        </div>
      </Field>

      <Field label="Prize Pool">
        <div className="flex items-stretch gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-background px-3">
            <Trophy className="size-4 text-muted-foreground" />
            <input
              type="text"
              inputMode="numeric"
              value={data.prizePool ?? ""}
              onChange={(e) =>
                onChange("prizePool", e.target.value ? e.target.value : null)
              }
              placeholder="e.g. 10,000,000"
              className="block w-full bg-transparent py-2 text-sm outline-none"
              data-testid="details-prize"
            />
          </div>
          <select
            value={data.currency ?? "VND"}
            onChange={(e) => onChange("currency", e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            data-testid="details-currency"
          >
            <option value="VND">VND</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
      </Field>

      <SaveButton loading={saving} disabled={nameInvalid} onClick={onSave}>
        Save and Continue
      </SaveButton>
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
    maxTeams: number;
  }) => void;
  saving: boolean;
}) {
  // Round-58 — Figma defaults: roster 3–8, max 24 teams. The Basics screen
  // creates comps with min=1 / max=null / maxTeams=null, so seed friendly
  // defaults the first time this tab renders. The displayed values are
  // exactly what saves — the field can't be left empty.
  const minPlayers = data.minPlayersPerTeam > 1 ? data.minPlayersPerTeam : 3;
  const maxPlayers = data.maxPlayersPerTeam ?? 8;
  const maxTeams = data.maxTeams ?? 24;
  const rosterInvalid = maxPlayers < minPlayers;

  const summary =
    `${data.applicationMode === "OPEN" ? "Any team can apply" : "Invite-only"}. ` +
    `Max ${maxTeams} participants. ` +
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
          value={maxTeams}
          onChange={(e) => {
            // Clamp to ≥2 and never allow an empty value to persist — a
            // cleared field falls back to the 24 default on blur/save.
            const n = Number(e.target.value);
            onChange("maxTeams", Number.isFinite(n) && n >= 2 ? n : 24);
          }}
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
            maxTeams,
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
// Structure tab — Figma node 170:4082 "Match Layout".
//
// The design works per-GAME, not per-block: every singles/doubles game is
// its own numbered draggable row, and "Break Time" rows sit between them.
// The DB model stays MatchFormatBlock (type, games, raceTo, breakAfterMin)
// — we expand blocks → rows on render and compress rows → blocks on every
// edit, mapping a Break row to `breakAfterMin` on the preceding block.
// ─────────────────────────────────────────────────────────────────────────

type LayoutItem = {
  id: string;
  kind: "SINGLES" | "DOUBLES" | "BREAK";
  raceTo: number;
};

let layoutSeq = 0;
function newItem(kind: LayoutItem["kind"], raceTo = 5): LayoutItem {
  layoutSeq += 1;
  return { id: `li-${layoutSeq}`, kind, raceTo };
}

function expandBlocks(blocks: CompetitionInitial["blocks"]): LayoutItem[] {
  const out: LayoutItem[] = [];
  for (const b of blocks) {
    const kind = b.type === "SINGLES" ? "SINGLES" : "DOUBLES";
    for (let g = 0; g < Math.max(1, b.games); g++) {
      out.push(newItem(kind, b.raceTo ?? 5));
    }
    if (b.breakAfterMin) out.push(newItem("BREAK"));
  }
  return out;
}

function compressItems(items: LayoutItem[]): CompetitionInitial["blocks"] {
  const blocks: Array<{
    type: "SINGLES" | "DOUBLES";
    games: number;
    raceTo: number | null;
    breakAfterMin: number | null;
  }> = [];
  for (const item of items) {
    if (item.kind === "BREAK") {
      // Attach to the preceding block; a leading break has nothing to
      // attach to and is dropped (the generator can't start with a break).
      const prev = blocks[blocks.length - 1];
      if (prev && !prev.breakAfterMin) prev.breakAfterMin = 10;
      continue;
    }
    const prev = blocks[blocks.length - 1];
    if (prev && prev.type === item.kind && !prev.breakAfterMin) {
      prev.games += 1;
    } else {
      blocks.push({
        type: item.kind,
        games: 1,
        raceTo: item.raceTo,
        breakAfterMin: null,
      });
    }
  }
  return blocks;
}

function SortableLayoutRow({
  item,
  number,
  onRemove,
}: {
  item: LayoutItem;
  number: number | null;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const isBreak = item.kind === "BREAK";
  return (
    <li
      ref={setNodeRef}
      style={style}
      data-testid={`structure-row-${item.id}`}
      className={cn(
        "flex items-center gap-2 rounded-md border border-white/10 px-2 py-2.5",
        isDragging && "z-10 opacity-80 shadow-lg",
        isBreak
          ? "bg-white/5"
          : item.kind === "SINGLES"
            ? "bg-sky-950"
            : "bg-purple-950",
      )}
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      {isBreak ? (
        <span className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Coffee className="size-4" />
          Break Time
        </span>
      ) : (
        <>
          <span className="w-5 text-center text-sm font-semibold">
            {number}
          </span>
          <span className="flex-1 text-sm text-muted-foreground">
            {item.kind === "SINGLES" ? "Singles Game" : "Doubles Game"}
          </span>
          <span className="rounded bg-primary/20 px-1.5 py-0.5 text-xs font-semibold text-primary">
            {item.kind === "SINGLES" ? "1 vs 1" : "2 vs 2"}
          </span>
        </>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        className="rounded-md p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </li>
  );
}

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
  // Per-game row model expanded from the block list; recompressed into
  // blocks on every edit so the parent's save + Review tab read live data.
  const [items, setItems] = useState<LayoutItem[]>(() =>
    expandBlocks(data.blocks),
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  function commit(next: LayoutItem[]) {
    setItems(next);
    onChange("blocks", compressItems(next));
  }

  function add(kind: LayoutItem["kind"]) {
    commit([...items, newItem(kind)]);
  }
  function removeAt(idx: number) {
    commit(items.filter((_, i) => i !== idx));
  }
  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from === -1 || to === -1) return;
    commit(arrayMove(items, from, to));
  }

  const singles = items.filter((i) => i.kind === "SINGLES").length;
  const doubles = items.filter((i) => i.kind === "DOUBLES").length;
  const total = singles + doubles;

  // Game numbers skip break rows (Figma numbers only the games).
  let gameNo = 0;
  const numbered = items.map((item) => {
    if (item.kind === "BREAK") return { item, number: null };
    gameNo += 1;
    return { item, number: gameNo };
  });

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="text-sm font-semibold">
          Build your match layout by adding game blocks
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Drag &amp; Drop to Reorder Match Layout
        </p>
      </div>

      <div className="mx-auto w-full max-w-md space-y-4 rounded-xl border border-white/10 bg-white/5 p-2">
        {items.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No games yet — add Singles or Doubles below.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-1" data-testid="structure-block-list">
                {numbered.map(({ item, number }, idx) => (
                  <SortableLayoutRow
                    key={item.id}
                    item={item}
                    number={number}
                    onRemove={() => removeAt(idx)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        <div className="space-y-2 pb-1 text-center">
          <p className="text-xs text-muted-foreground">Add Game Block</p>
          <div className="flex items-stretch gap-2">
            {(
              [
                ["SINGLES", "Singles"],
                ["DOUBLES", "Doubles"],
                ["BREAK", "Break"],
              ] as const
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                onClick={() => add(kind)}
                className="flex flex-1 items-center justify-center gap-2 rounded-md border border-dashed border-primary/50 px-3 py-2 text-sm text-primary hover:bg-primary/5"
                data-testid={`structure-add-${kind.toLowerCase()}`}
              >
                <Plus className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <SummaryBox
        items={
          total > 0
            ? [
                `Teams will play ${total} games per match: ${singles} singles and ${doubles} doubles`,
                "Team Captains will assign players before the match and/or during the breaks",
              ]
            : ["Add Singles and/or Doubles games to define your match layout"]
        }
      />

      <SaveButton loading={saving} onClick={onSave} disabled={total === 0}>
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
        label="Details"
        onEdit={() => onEdit("details")}
        rows={[
          ["Name", data.name || "—"],
          [
            "Start date",
            data.startDate
              ? new Date(data.startDate).toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              : "—",
          ],
          [
            "Prize pool",
            data.prizePool
              ? `${data.prizePool} ${data.currency ?? ""}`.trim()
              : "—",
          ],
        ]}
      />
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

