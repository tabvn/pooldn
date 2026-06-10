"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@apollo/client/react";
import { ArrowLeft, ArrowRight, CalendarDays, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { CitiesQuery } from "@/lib/graphql/operations/competition.operations";
import {
  CreateCompetitionMutation,
  UpdateCompetitionMutation,
} from "@/lib/graphql/operations/competition-mutations.operations";
import {
  StructureBuilder,
  type StructureItem,
  blocksToStructureItems,
  structureItemsToBlocks,
} from "@/components/competition/structure-builder";
import { planMatchdays } from "@/lib/services/match-schedule.service";

const GAME_TYPES = ["EIGHT_BALL", "NINE_BALL", "TEN_BALL", "STRAIGHT_POOL"] as const;
// Round-25 P0 gate — generateMatchdays only knows round-robin pairings today.
// Other formats are kept in the GraphQL enum (data already in flight) but the
// wizard refuses to create one. Same for INDIVIDUAL — the rest of the app is
// team-centric.
const FORMATS = ["ROUND_ROBIN"] as const;
const TYPES = ["TEAMS"] as const;

// Figma-driven Step 1 tab/card option lists. The "soon" entries are rendered
// disabled so admins see the roadmap without being able to pick something the
// engine can't run yet (lines up with [[feedback_admin_can_edit]] — admins still
// see the wider menu, but the schema gate keeps DB writes safe).
const GAME_TYPE_TABS: { value: (typeof GAME_TYPES)[number]; label: string; soon?: boolean }[] = [
  { value: "EIGHT_BALL", label: "8-Ball" },
  { value: "NINE_BALL", label: "9-Ball" },
  { value: "TEN_BALL", label: "10-Ball" },
  { value: "STRAIGHT_POOL", label: "Straight" },
];

const FORMAT_TABS: { value: (typeof TYPES)[number] | "INDIVIDUAL" | "DOUBLES"; label: string; soon?: boolean }[] = [
  { value: "TEAMS", label: "Teams" },
  { value: "INDIVIDUAL", label: "Singles", soon: true },
  { value: "DOUBLES", label: "Doubles (2v2)", soon: true },
];

type TournamentTypeOption = {
  value: (typeof FORMATS)[number] | "SINGLE_ELIMINATION" | "DOUBLE_ELIMINATION";
  title: string;
  bullets: string[];
  soon?: boolean;
};

const TOURNAMENT_TYPES: TournamentTypeOption[] = [
  {
    value: "ROUND_ROBIN",
    title: "League (Round-Robin)",
    bullets: [
      "Everyone plays everyone",
      "Pick a single round (Round Robin) or multiple rounds (League-style)",
      "Standings based on points",
      "Works for short groups and longer seasons",
    ],
  },
  {
    value: "SINGLE_ELIMINATION",
    title: "Single Elimination (Knockout)",
    bullets: ["Lose once = out", "Fast bracket, ideal for quick tournaments"],
    soon: true,
  },
  {
    value: "DOUBLE_ELIMINATION",
    title: "Double Elimination",
    bullets: [
      "Players get a second chance",
      "Has Winners & Losers bracket",
      "Ends with a Grand Final (with possible bracket reset)",
    ],
    soon: true,
  },
];

const blankToUndefined = (v: unknown) =>
  v === "" || v == null ? undefined : v;
const optionalCount = (min: number) =>
  z.preprocess(blankToUndefined, z.coerce.number().int().min(min).optional());
const optionalDate = z.preprocess(
  blankToUndefined,
  z
    .string()
    .optional()
    .transform((s) => (s ? new Date(s).toISOString() : undefined)),
);

const GAME_BLOCK_TYPES = ["SINGLES", "DOUBLES", "SCOTCH_DOUBLES"] as const;
const SCHEDULING_TYPES = [
  "FIXED_DATE",
  "FLEXIBLE",
  "AUTO_GENERATED",
  "WEEKLY_ROUNDS",
  "FIXED_MATCHDAYS",
] as const;
const APPLICATION_MODES = ["OPEN", "INVITE_ONLY"] as const;
const MATCH_VENUE_MODES = ["TEAM_VENUES", "CENTRAL_VENUE"] as const;

// Round-48 (wizard) — Figma "Scheduling Type → Weekly Rounds" weekday list.
// weekday: 0 = Sun, 1 = Mon, …, 6 = Sat (matches JS Date.getDay()).
const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
] as const;

const weekdaySlotSchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  time: z.string().regex(/^\d{1,2}:\d{2}$/, "Pick a time"),
});

// The wizard stores the Structure step as a flat list of UI items (game OR
// break), serialised into MatchFormatBlock rows at submit time.
const structureItemSchema = z.discriminatedUnion("kind", [
  z.object({
    uid: z.string(),
    kind: z.literal("GAME"),
    type: z.enum(GAME_BLOCK_TYPES),
    games: z.coerce.number().int().min(1),
    raceTo: z.coerce.number().int().min(1).nullable().optional(),
  }),
  z.object({
    uid: z.string(),
    kind: z.literal("BREAK"),
    durationMin: z.coerce.number().int().min(1),
  }),
]);

const schema = z.object({
  // Step 1 — Basics
  name: z.string().min(3, "At least 3 characters"),
  slug: z
    .string()
    .min(3, "At least 3 characters")
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, hyphens only"),
  description: z.string().optional(),
  rulesUrl: z
    .string()
    .url("Must be a valid URL")
    .or(z.literal(""))
    .optional(),
  gameType: z.enum(GAME_TYPES),
  type: z.enum(TYPES),
  format: z.enum(FORMATS),
  // Step 2 — Participants
  minTeams: z.coerce.number().int().min(2),
  maxTeams: optionalCount(2),
  minPlayersPerTeam: z.coerce.number().int().min(1),
  maxPlayersPerTeam: optionalCount(1),
  raceToFrames: z.coerce.number().int().min(1),
  // Step 3 — Schedule
  cityId: z.string().optional(),
  schedulingType: z.enum(SCHEDULING_TYPES),
  startDate: optionalDate,
  endDate: optionalDate,
  matchdayCount: z.coerce.number().int().min(1).max(52),
  matchdayStartTime: z.string().optional(),
  matchdayEndTime: z.string().optional(),
  maxGamesPerVenuePerMatchday: optionalCount(1),
  prizePool: z.string().optional(),
  currency: z.string().min(1),
  // Step 4 — Structure & Rules
  structureItems: z
    .array(structureItemSchema)
    .min(1, "Add at least one block")
    .refine(
      (items) => items.some((i) => i.kind === "GAME"),
      "Structure must contain at least one game block",
    ),
  breakAndRunRule: z.boolean(),
  // Round-48 — apply-time gate. When ON the apply form blocks any team
  // whose Team.homeVenueId is null, with Figma copy "This competition
  // requires each team to have a home venue."
  requiresHomeVenue: z.boolean(),
  // Round-48 (wizard) — Figma "How Participants Apply" + Schedule fields.
  applicationMode: z.enum(APPLICATION_MODES),
  invitedTeamIds: z.array(z.string()).optional(),
  matchVenueMode: z.enum(MATCH_VENUE_MODES),
  centralVenueId: z.string().optional(),
  gamesPerOpponent: z.coerce.number().int().min(1).max(4),
  weekdaySchedule: z.array(weekdaySlotSchema).optional(),
})
  // End date can't precede start date when both are set.
  .refine(
    (v) => {
      if (!v.startDate || !v.endDate) return true;
      return new Date(v.endDate).getTime() >= new Date(v.startDate).getTime();
    },
    { message: "End date must be on or after the start date", path: ["endDate"] },
  );

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

// Round-48 (wizard) — Figma stepper. Dropped the standalone "Season preview"
// step; the generated calendar lives at the bottom of Schedule's summary now
// (and again on Review & Publish), so it stays visible without being its own
// page-turn.
const STEPS = [
  { title: "Basics", desc: "Name, game, format, tournament type, start date and prize." },
  { title: "Participants", desc: "Team and player counts." },
  { title: "Schedule", desc: "Where, how often and on which weekdays matches are played." },
  { title: "Structure", desc: "Match builder + rules (Break & Run)." },
  { title: "Review & Publish", desc: "Confirm everything before you publish." },
] as const;

type StepIndex = 0 | 1 | 2 | 3 | 4;
const FIELDS_BY_STEP: Record<StepIndex, (keyof FormInput)[]> = {
  0: [
    "name",
    "slug",
    "description",
    "rulesUrl",
    "gameType",
    "type",
    "format",
    "startDate",
    "prizePool",
    "currency",
  ],
  1: [
    "minTeams",
    "maxTeams",
    "minPlayersPerTeam",
    "maxPlayersPerTeam",
    "raceToFrames",
    "requiresHomeVenue",
    "applicationMode",
    "invitedTeamIds",
  ],
  2: [
    "cityId",
    "schedulingType",
    "endDate",
    "matchdayCount",
    "matchdayStartTime",
    "matchdayEndTime",
    "maxGamesPerVenuePerMatchday",
    "matchVenueMode",
    "centralVenueId",
    "gamesPerOpponent",
    "weekdaySchedule",
  ],
  3: ["structureItems", "breakAndRunRule"],
  4: [],
};

export type WizardInitial = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  rulesUrl?: string | null;
  type: string;
  format: string;
  gameType: string;
  minTeams: number;
  maxTeams?: number | null;
  minPlayersPerTeam: number;
  maxPlayersPerTeam?: number | null;
  raceToFrames: number;
  cityId?: string | null;
  schedulingType?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  prizePool?: string | null;
  currency: string;
  breakAndRunRule: boolean;
  requiresHomeVenue: boolean;
  applicationMode?: string | null;
  invitedTeamIds?: string[] | null;
  matchVenueMode?: string | null;
  centralVenueId?: string | null;
  gamesPerOpponent?: number | null;
  weekdaySchedule?: Array<{ weekday: number; time: string }> | null;
  maxGamesPerVenuePerMatchday?: number | null;
  blocks: Array<{
    type: "SINGLES" | "DOUBLES" | "SCOTCH_DOUBLES";
    games: number;
    raceTo?: number | null;
    breakAfterMin?: number | null;
  }>;
};

export function NewCompetitionForm({
  initial,
  defaultCityId,
}: {
  initial?: WizardInitial;
  defaultCityId?: string | null;
} = {}) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = !!initial;
  const [step, setStep] = useState<StepIndex>(0);
  const [create, { error: createError }] = useMutation(CreateCompetitionMutation);
  const [update, { error: updateError }] = useMutation(UpdateCompetitionMutation);
  const error = createError ?? updateError;
  const citiesQuery = useQuery(CitiesQuery);
  const cities = citiesQuery.data?.cities ?? [];

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: initial
      ? {
          name: initial.name,
          slug: initial.slug,
          description: initial.description ?? "",
          rulesUrl: initial.rulesUrl ?? "",
          gameType: initial.gameType as never,
          type: initial.type as never,
          format: initial.format as never,
          minTeams: initial.minTeams,
          maxTeams: initial.maxTeams ?? undefined,
          minPlayersPerTeam: initial.minPlayersPerTeam,
          maxPlayersPerTeam: initial.maxPlayersPerTeam ?? undefined,
          raceToFrames: initial.raceToFrames,
          cityId: initial.cityId ?? "",
          schedulingType:
            (initial.schedulingType as never) ?? ("FLEXIBLE" as never),
          startDate: initial.startDate
            ? initial.startDate.slice(0, 10)
            : undefined,
          endDate: initial.endDate ? initial.endDate.slice(0, 10) : undefined,
          matchdayCount: 6,
          matchdayStartTime: "19:00",
          matchdayEndTime: "23:00",
          prizePool: initial.prizePool ?? "",
          currency: initial.currency,
          breakAndRunRule: initial.breakAndRunRule,
          requiresHomeVenue: initial.requiresHomeVenue,
          applicationMode: (initial.applicationMode as never) ?? "OPEN",
          invitedTeamIds: initial.invitedTeamIds ?? [],
          matchVenueMode:
            (initial.matchVenueMode as never) ?? "TEAM_VENUES",
          centralVenueId: initial.centralVenueId ?? "",
          gamesPerOpponent: initial.gamesPerOpponent ?? 1,
          weekdaySchedule: initial.weekdaySchedule ?? [],
          maxGamesPerVenuePerMatchday:
            initial.maxGamesPerVenuePerMatchday ?? undefined,
          structureItems:
            blocksToStructureItems(initial.blocks).length > 0
              ? blocksToStructureItems(initial.blocks)
              : [
                  {
                    uid: "s-default-1",
                    kind: "GAME",
                    type: "SINGLES",
                    games: 3,
                  },
                ],
        }
      : {
          gameType: "TEN_BALL",
          format: "ROUND_ROBIN",
          type: "TEAMS",
          minTeams: 2,
          minPlayersPerTeam: 1,
          raceToFrames: 5,
          currency: "VND",
          schedulingType: "FLEXIBLE",
          cityId: defaultCityId ?? undefined,
          matchdayCount: 6,
          matchdayStartTime: "19:00",
          matchdayEndTime: "23:00",
          requiresHomeVenue: false,
          applicationMode: "OPEN",
          invitedTeamIds: [],
          matchVenueMode: "TEAM_VENUES",
          centralVenueId: "",
          gamesPerOpponent: 1,
          weekdaySchedule: [
            { weekday: 2, time: "21:00" },
            { weekday: 5, time: "21:00" },
          ],
          structureItems: [
            { uid: "s-default-1", kind: "GAME", type: "SINGLES", games: 3 },
            { uid: "s-default-2", kind: "BREAK", durationMin: 10 },
            { uid: "s-default-3", kind: "GAME", type: "DOUBLES", games: 2 },
          ],
          breakAndRunRule: false,
        },
  });
  const {
    register,
    handleSubmit,
    control,
    trigger,
    formState: { errors, isSubmitting },
    watch,
    setValue,
  } = form;

  async function nextStep() {
    const ok = await trigger(FIELDS_BY_STEP[step], { shouldFocus: true });
    if (!ok) {
      // Round-48 (wizard) — Bug 2 from the round-48 feedback doc: nextStep
      // used to silently swallow validation failures, stranding users on
      // steps whose offending field wasn't a focusable input (e.g.
      // structureItems is an array). Surface the first error as a toast so
      // the user always sees WHY Next didn't move.
      const fields = FIELDS_BY_STEP[step];
      const firstField = fields.find(
        (f) => form.formState.errors[f as keyof FormInput],
      );
      const message = firstField
        ? (form.formState.errors[firstField as keyof FormInput]?.message as
            | string
            | undefined) ?? "Please fix the highlighted fields to continue."
        : "Please fix the highlighted fields to continue.";
      toast.error("Can't continue yet", message);
      return;
    }
    setStep((s) => (Math.min(s + 1, 4) as StepIndex));
  }

  function prevStep() {
    setStep((s) => (Math.max(s - 1, 0) as StepIndex));
  }

  // Auto-derive slug from name (slugify) until the user has manually edited
  // the slug field. A ref backs the touched flag so the deferred microtask
  // reads the *current* value (state closure would lag a tick and overwrite
  // the user's typed slug under fast Playwright fills).
  const slugTouchedRef = useRef(isEdit);
  const watchedName = watch("name");
  const watchedSlug = watch("slug");
  if (!slugTouchedRef.current && watchedName) {
    const derived = slugify(watchedName);
    if (derived && derived !== watchedSlug) {
      queueMicrotask(() => {
        if (!slugTouchedRef.current) {
          setValue("slug", derived, { shouldValidate: false });
        }
      });
    }
  }

  // Round-48 (wizard) — `triggerSubmit` is the ONLY path that actually
  // executes the mutation. The form itself never auto-submits (the
  // <form> element has a preventDefault onSubmit and every nav button is
  // type="button"), so neither Enter inside an input NOR a button-swap
  // mouseup race can fire the mutation. Calling triggerSubmit also runs
  // RHF validation up-front via handleSubmit().
  const triggerSubmit = handleSubmit(async (values) => {
    if (step !== 4) return;
    const blocks = structureItemsToBlocks(values.structureItems);
    try {
      if (isEdit && initial) {
        const result = await update({
          variables: {
            id: initial.id,
            input: {
              name: values.name,
              description: values.description || null,
              rulesUrl: values.rulesUrl || null,
              cityId: values.cityId || null,
              gameType: values.gameType,
              format: values.format,
              type: values.type,
              minTeams: values.minTeams,
              maxTeams: values.maxTeams ?? null,
              minPlayersPerTeam: values.minPlayersPerTeam,
              maxPlayersPerTeam: values.maxPlayersPerTeam ?? null,
              raceToFrames: values.raceToFrames,
              startDate: values.startDate ?? null,
              endDate: values.endDate ?? null,
              prizePool: values.prizePool || null,
              currency: values.currency,
              schedulingType: values.schedulingType,
              breakAndRunRule: values.breakAndRunRule,
              requiresHomeVenue: values.requiresHomeVenue,
              applicationMode: values.applicationMode,
              invitedTeamIds: values.invitedTeamIds ?? [],
              matchVenueMode: values.matchVenueMode,
              centralVenueId: values.centralVenueId || null,
              gamesPerOpponent: values.gamesPerOpponent,
              weekdaySchedule: (values.weekdaySchedule ?? []).map((w) => ({
                weekday: w.weekday,
                time: w.time,
              })),
              maxGamesPerVenuePerMatchday:
                values.maxGamesPerVenuePerMatchday ?? null,
              blocks,
            },
          },
        });
        if (result.data?.updateCompetition) {
          toast.success(`${result.data.updateCompetition.name} saved`);
          router.push(`/competitions/${result.data.updateCompetition.slug}`);
          router.refresh();
        }
        return;
      }
      const result = await create({
        variables: {
          input: {
            name: values.name,
            slug: values.slug,
            description: values.description || null,
            rulesUrl: values.rulesUrl || null,
            cityId: values.cityId || null,
            gameType: values.gameType,
            format: values.format,
            type: values.type,
            minTeams: values.minTeams,
            maxTeams: values.maxTeams ?? null,
            minPlayersPerTeam: values.minPlayersPerTeam,
            maxPlayersPerTeam: values.maxPlayersPerTeam ?? null,
            raceToFrames: values.raceToFrames,
            startDate: values.startDate ?? null,
            endDate: values.endDate ?? null,
            prizePool: values.prizePool || null,
            currency: values.currency,
            schedulingType: values.schedulingType,
            breakAndRunRule: values.breakAndRunRule,
            requiresHomeVenue: values.requiresHomeVenue,
            applicationMode: values.applicationMode,
            invitedTeamIds: values.invitedTeamIds ?? [],
            matchVenueMode: values.matchVenueMode,
            centralVenueId: values.centralVenueId || null,
            gamesPerOpponent: values.gamesPerOpponent,
            weekdaySchedule: (values.weekdaySchedule ?? []).map((w) => ({
              weekday: w.weekday,
              time: w.time,
            })),
            maxGamesPerVenuePerMatchday:
              values.maxGamesPerVenuePerMatchday ?? null,
            blocks,
          },
        },
      });
      if (result.data?.createCompetition) {
        toast.success(`${result.data.createCompetition.name} created`);
        router.push(`/competitions/${result.data.createCompetition.slug}`);
        router.refresh();
      }
    } catch (e) {
      toast.error(
        isEdit ? "Could not save competition" : "Could not create competition",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  });

  const v = watch();

  return (
    <div className="min-h-full">
      {/* Lime header band — matches the Figma "Create Competition / Step N" */}
      <header
        className="px-4 py-6 md:px-8 md:py-8"
        style={{
          background:
            "linear-gradient(135deg, #d0f30d 0%, #c4e60d 60%, #a9c80a 100%)",
        }}
      >
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-black/60">
                {isEdit ? "Edit competition" : "Create competition"}
              </p>
              <h1 className="text-3xl font-black text-black mt-1">
                Step {step + 1} · {STEPS[step].title}
              </h1>
              <p className="text-sm text-black/70 mt-1">{STEPS[step].desc}</p>
            </div>
            <span className="rounded-full bg-black/15 px-3 py-1 text-xs font-bold text-black">
              {step + 1} / {STEPS.length}
            </span>
          </div>

          {/* Round-48 (wizard) — Figma stepper: labeled tabs with a strong
              lime/black active state, a check on completed steps, and muted
              chrome for future steps. Past steps clickable so the organizer
              can hop back. */}
          <ol
            className="flex items-stretch gap-1 rounded-lg bg-black/10 p-1"
            aria-label="Wizard progress"
            data-testid="wizard-stepper"
          >
            {STEPS.map((s, i) => {
              const isPast = i < step;
              const isCurrent = i === step;
              const interactive = isPast;
              return (
                <li key={s.title} className="flex-1">
                  <button
                    type="button"
                    onClick={() => interactive && setStep(i as StepIndex)}
                    disabled={!interactive && !isCurrent}
                    aria-current={isCurrent ? "step" : undefined}
                    data-testid={`stepper-${i}`}
                    className={cn(
                      "block w-full rounded-md px-3 py-2 text-left transition-colors",
                      isCurrent
                        ? "bg-black text-primary shadow-sm"
                        : isPast
                          ? "bg-transparent text-black hover:bg-black/10 cursor-pointer"
                          : "bg-transparent text-black/40 cursor-not-allowed",
                    )}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                      {isPast ? <Check className="size-3" /> : <span>{i + 1}</span>}
                    </div>
                    <div
                      className={cn(
                        "mt-0.5 text-xs font-bold leading-tight",
                        isCurrent ? "text-primary" : undefined,
                      )}
                    >
                      {s.title}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </header>

      <form
        id="new-comp"
        onSubmit={(e) => {
          // Round-48 (wizard) — never auto-submit. The Confirm button calls
          // `triggerSubmit()` directly; this handler exists only to swallow
          // Enter-key submissions from inputs deep in the form.
          e.preventDefault();
        }}
        className="px-8 py-8 max-w-3xl mx-auto space-y-6"
      >
        {step === 0 && (
          <Section>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Competition name" error={errors.name?.message}>
                <Input invalid={!!errors.name} {...register("name")} />
              </Field>
              <Field
                label="Slug"
                hint={
                  isEdit
                    ? "Slug is the URL — locked after creation."
                    : "Auto-generated from the name. Edit to override."
                }
                error={errors.slug?.message}
              >
                <Input
                  placeholder="da-nang-spring-2027"
                  invalid={!!errors.slug}
                  disabled={isEdit}
                  {...register("slug", {
                    onChange: () => {
                      slugTouchedRef.current = true;
                    },
                  })}
                />
              </Field>
            </div>
            <Field label="Description (optional)">
              <Input
                placeholder="Short summary that appears on the competition page"
                {...register("description")}
              />
            </Field>
            <Field
              label="Rules document (optional)"
              hint="Link to a PDF or web page with the full rules. Shown on the About tab."
              error={errors.rulesUrl?.message}
            >
              <Input
                placeholder="https://…"
                invalid={!!errors.rulesUrl}
                {...register("rulesUrl")}
              />
            </Field>
            <Field label="Game type">
              <Controller
                control={control}
                name="gameType"
                render={({ field }) => (
                  <SegmentedTabs
                    value={field.value}
                    onValueChange={(v) =>
                      field.onChange(v as (typeof GAME_TYPES)[number])
                    }
                    options={GAME_TYPE_TABS}
                    testIdPrefix="comp-gametype"
                  />
                )}
              />
            </Field>
            <Field label="Format">
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <SegmentedTabs
                    value={field.value}
                    onValueChange={(v) =>
                      field.onChange(v as (typeof TYPES)[number])
                    }
                    options={FORMAT_TABS}
                    testIdPrefix="comp-format"
                  />
                )}
              />
            </Field>
            <Field label="Tournament type">
              <Controller
                control={control}
                name="format"
                render={({ field }) => (
                  <div className="space-y-2" data-testid="comp-tournament-types">
                    {TOURNAMENT_TYPES.map((t) => (
                      <TournamentTypeCard
                        key={t.value}
                        option={t}
                        selected={field.value === t.value}
                        onSelect={() => {
                          if (!t.soon)
                            field.onChange(t.value as (typeof FORMATS)[number]);
                        }}
                      />
                    ))}
                  </div>
                )}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field
                label="Start date (optional)"
                error={errors.startDate?.message}
              >
                <DateInput {...register("startDate")} />
              </Field>
              <Field label="Prize (optional)">
                <Input
                  type="text"
                  placeholder="Prize info (money or gifts)"
                  {...register("prizePool")}
                />
              </Field>
            </div>
            <StepSummary testId="basics-summary" bullets={basicsSummary(v)} />
          </Section>
        )}

        {step === 1 && (
          <Section>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Field label="Min teams" error={errors.minTeams?.message}>
                <Input
                  type="number"
                  min={2}
                  defaultValue={2}
                  invalid={!!errors.minTeams}
                  {...register("minTeams")}
                />
              </Field>
              <Field
                label="Max teams (optional)"
                error={errors.maxTeams?.message}
              >
                <Input type="number" min={2} {...register("maxTeams")} />
              </Field>
              <Field
                label="Min players / team"
                error={errors.minPlayersPerTeam?.message}
              >
                <Input
                  type="number"
                  min={1}
                  defaultValue={1}
                  invalid={!!errors.minPlayersPerTeam}
                  {...register("minPlayersPerTeam")}
                />
              </Field>
              <Field
                label="Max players / team (optional)"
                error={errors.maxPlayersPerTeam?.message}
              >
                <Input type="number" min={1} {...register("maxPlayersPerTeam")} />
              </Field>
            </div>
            <Field
              label="Race to frames"
              hint="Number of frames a team must win to take a match"
              error={errors.raceToFrames?.message}
            >
              <Input
                type="number"
                min={1}
                defaultValue={5}
                invalid={!!errors.raceToFrames}
                {...register("raceToFrames")}
              />
            </Field>
            {/* Round-48 — applicant-side gate. */}
            <div className="rounded-xl border border-border bg-card p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-primary"
                  {...register("requiresHomeVenue")}
                />
                <span>
                  <span className="block font-semibold">
                    Require each team to have a home venue
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    When on, the apply form blocks any team that hasn't set a
                    home venue. Captains see the exact message
                    "This competition requires each team to have a home venue."
                  </span>
                </span>
              </label>
            </div>

            {/* Round-48 (wizard) — Figma "How Participants Apply" selector. */}
            <Field label="How Participants Apply">
              <Controller
                control={control}
                name="applicationMode"
                render={({ field }) => (
                  <SegmentedTabs
                    value={field.value}
                    onValueChange={(val) => field.onChange(val as never)}
                    options={[
                      { value: "OPEN", label: "Any team can apply" },
                      { value: "INVITE_ONLY", label: "Invite only" },
                    ]}
                    testIdPrefix="comp-app-mode"
                  />
                )}
              />
              <p className="mt-2 rounded-md border border-info/30 bg-info/10 px-3 py-2 text-xs text-info-foreground">
                {v.applicationMode === "INVITE_ONLY"
                  ? "Only teams you invite from the competition detail page can apply."
                  : "Any team captain can submit an application once you publish."}
              </p>
            </Field>

            <StepSummary
              testId="participants-summary"
              bullets={participantsSummary(v)}
            />
          </Section>
        )}

        {step === 2 && (
          <Section>
            {/* Where Matches Are Played? — TEAM_VENUES vs CENTRAL_VENUE */}
            <Field label="Where Matches Are Played?">
              <Controller
                control={control}
                name="matchVenueMode"
                render={({ field }) => (
                  <SegmentedTabs
                    value={field.value}
                    onValueChange={(val) => field.onChange(val as never)}
                    options={[
                      { value: "TEAM_VENUES", label: "Team Venues" },
                      { value: "CENTRAL_VENUE", label: "Central Venue" },
                    ]}
                    testIdPrefix="comp-venue-mode"
                  />
                )}
              />
              <p className="mt-2 rounded-md border border-info/30 bg-info/10 px-3 py-2 text-xs text-info-foreground">
                {v.matchVenueMode === "CENTRAL_VENUE"
                  ? "All matches play at one central venue you pick below."
                  : "Teams will have games in their home venues."}
              </p>
              {v.matchVenueMode === "CENTRAL_VENUE" ? (
                <div className="mt-3">
                  <Field label="Central venue">
                    <Controller
                      control={control}
                      name="centralVenueId"
                      render={({ field }) => (
                        <Select
                          value={field.value ?? ""}
                          onValueChange={field.onChange}
                          placeholder="Pick a venue"
                          options={[
                            {
                              value: "",
                              label: (
                                <span className="text-muted-foreground">
                                  — pick a venue —
                                </span>
                              ),
                            },
                            // Pull from cities-with-venues, but we don't load
                            // venues client-side here — organizer can update
                            // post-create. Future: VenuesListQuery integration.
                          ]}
                        />
                      )}
                    />
                  </Field>
                </div>
              ) : null}
            </Field>

            {/* Games per Opponent — 1 (Only Once) vs 2 (Home & Away) */}
            <Field label="Games per Opponent">
              <Controller
                control={control}
                name="gamesPerOpponent"
                render={({ field }) => (
                  <SegmentedTabs
                    value={String(field.value)}
                    onValueChange={(val) => field.onChange(Number(val))}
                    options={[
                      { value: "2", label: "Home & Away" },
                      { value: "1", label: "Only Once" },
                    ]}
                    testIdPrefix="comp-games-per-opp"
                  />
                )}
              />
              <p className="mt-2 rounded-md border border-info/30 bg-info/10 px-3 py-2 text-xs text-info-foreground">
                {Number(v.gamesPerOpponent) === 2
                  ? "Each team plays twice (home & away) against every other team."
                  : "Each team plays each opponent once."}
              </p>
            </Field>

            {/* Scheduling Type — Weekly Rounds vs Fixed Match Days */}
            <Field label="Scheduling Type">
              <Controller
                control={control}
                name="schedulingType"
                render={({ field }) => (
                  <SegmentedTabs
                    value={
                      field.value === "FIXED_MATCHDAYS"
                        ? "FIXED_MATCHDAYS"
                        : "WEEKLY_ROUNDS"
                    }
                    onValueChange={(val) => field.onChange(val as never)}
                    options={[
                      { value: "WEEKLY_ROUNDS", label: "Weekly Rounds" },
                      { value: "FIXED_MATCHDAYS", label: "Fixed Match Day(s)" },
                    ]}
                    testIdPrefix="comp-sched-type"
                  />
                )}
              />
              {v.schedulingType === "FIXED_MATCHDAYS" ? (
                <p className="mt-2 rounded-md border border-info/30 bg-info/10 px-3 py-2 text-xs text-info-foreground">
                  Each matchday gets a fixed date set after publish. Configure
                  the count and per-matchday timing in the next phase.
                </p>
              ) : (
                <div className="mt-3">
                  <Controller
                    control={control}
                    name="weekdaySchedule"
                    render={({ field }) => (
                      <WeekdayListEditor
                        value={(field.value ?? []) as Array<{
                          weekday: number;
                          time: string;
                        }>}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </div>
              )}
            </Field>

            {/* Cadence / cap knobs that still apply regardless of mode. */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field
                label="Matchdays"
                hint="How many matchdays the schedule should span."
                error={errors.matchdayCount?.message}
              >
                <Input
                  type="number"
                  min={1}
                  max={52}
                  invalid={!!errors.matchdayCount}
                  {...register("matchdayCount")}
                />
              </Field>
              <Field label="End date (optional)" error={errors.endDate?.message}>
                <DateInput {...register("endDate")} />
              </Field>
              <Field
                label="Max games per venue per matchday (optional)"
                hint="Cap on matches at the same venue in one matchday. Leave empty for no cap."
                error={errors.maxGamesPerVenuePerMatchday?.message}
              >
                <Input
                  type="number"
                  min={1}
                  placeholder="No limit"
                  {...register("maxGamesPerVenuePerMatchday")}
                />
              </Field>
            </div>

            <StepSummary
              testId="schedule-summary"
              bullets={scheduleSummary(v)}
            />
          </Section>
        )}

        {step === 3 && (
          <Controller
            control={control}
            name="structureItems"
            render={({ field }) => {
              const items = (field.value ?? []) as StructureItem[];
              const totalGames = items.reduce(
                (n, it) => n + (it.kind === "GAME" ? Number(it.games) || 0 : 0),
                0,
              );
              return (
                <div className="space-y-4">
                  <StructureBuilder
                    items={items}
                    onChange={(next) => field.onChange(next)}
                    totalGames={totalGames}
                  />
                  {errors.structureItems ? (
                    <p className="text-xs text-destructive">
                      {typeof errors.structureItems.message === "string"
                        ? errors.structureItems.message
                        : "Fix the structure to continue."}
                    </p>
                  ) : null}
                  <div className="rounded-xl border border-border bg-card p-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 accent-primary"
                        {...register("breakAndRunRule")}
                      />
                      <span>
                        <span className="block font-semibold">
                          Break &amp; Run rule
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          When a player breaks and runs the rack without
                          letting the opponent take a shot, they win the frame
                          outright.
                        </span>
                      </span>
                    </label>
                  </div>
                  <StepSummary
                    testId="structure-summary"
                    bullets={structureSummary(v)}
                  />
                </div>
              );
            }}
          />
        )}

        {step === 4 && (
          <Section>
            <h2 className="text-lg font-semibold mb-2">Review &amp; Publish</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Confirm everything below before you publish. You can still edit
              the competition while it&apos;s in DRAFT.
            </p>

            <ReviewGroup title="Basics" onEdit={() => setStep(0)}>
              <Row label="Name" value={v.name} />
              <Row label="Slug" value={v.slug} mono />
              <Row
                label="Game"
                value={
                  GAME_TYPE_TABS.find((g) => g.value === v.gameType)?.label ??
                  String(v.gameType)
                }
              />
              <Row
                label="Format"
                value={
                  FORMAT_TABS.find((f) => f.value === v.type)?.label ??
                  String(v.type)
                }
              />
              <Row
                label="Tournament type"
                value={
                  TOURNAMENT_TYPES.find((t) => t.value === v.format)?.title ??
                  String(v.format)
                }
              />
              <Row
                label="Start date"
                value={v.startDate ? formatYmd(String(v.startDate)) : "TBD"}
              />
              <Row
                label="Prize"
                value={
                  v.prizePool
                    ? `${v.prizePool}${v.currency ? ` ${v.currency}` : ""}`
                    : "—"
                }
              />
              {v.description ? (
                <Row label="Description" value={v.description} />
              ) : null}
            </ReviewGroup>

            <ReviewGroup title="Participants" onEdit={() => setStep(1)}>
              <Row
                label="How participants apply"
                value={
                  v.applicationMode === "INVITE_ONLY"
                    ? `Invite-only · ${(v.invitedTeamIds ?? []).length} team(s) invited`
                    : "Any team can apply"
                }
              />
              <Row
                label="Min / max teams"
                value={`${v.minTeams}${v.maxTeams ? ` – ${v.maxTeams}` : "+"}`}
              />
              <Row
                label="Min / max players"
                value={`${v.minPlayersPerTeam}${v.maxPlayersPerTeam ? ` – ${v.maxPlayersPerTeam}` : "+"}`}
              />
              <Row label="Race to" value={`${v.raceToFrames} frames`} />
              <Row
                label="Home venue required"
                value={v.requiresHomeVenue ? "Yes" : "No"}
              />
            </ReviewGroup>

            <ReviewGroup title="Schedule" onEdit={() => setStep(2)}>
              <Row
                label="Where matches are played"
                value={
                  v.matchVenueMode === "CENTRAL_VENUE"
                    ? "Central venue"
                    : "Team venues"
                }
              />
              <Row
                label="Games per opponent"
                value={
                  Number(v.gamesPerOpponent) === 2 ? "Home & Away" : "Only once"
                }
              />
              <Row
                label="Dates"
                value={
                  v.startDate
                    ? `${formatYmd(String(v.startDate))}${
                        v.endDate ? ` – ${formatYmd(String(v.endDate))}` : ""
                      }`
                    : "TBD"
                }
              />
              <Row
                label="City"
                value={cities.find((c) => c.id === v.cityId)?.name ?? "—"}
              />
              <Row
                label="Scheduling type"
                value={
                  v.schedulingType === "FIXED_MATCHDAYS"
                    ? "Fixed Match Day(s)"
                    : "Weekly Rounds"
                }
              />
              <Row label="Matchdays" value={Number(v.matchdayCount ?? 0)} />
              {((v.weekdaySchedule ?? []) as Array<{
                weekday: number;
                time: string;
              }>).length > 0 ? (
                <Row
                  label="Weekday slots"
                  value={((v.weekdaySchedule ?? []) as Array<{
                    weekday: number;
                    time: string;
                  }>)
                    .map(
                      (s) =>
                        `${WEEKDAY_LABEL[s.weekday] ?? "—"} @ ${formatTimeHuman(
                          s.time,
                        )}`,
                    )
                    .join(", ")}
                />
              ) : null}
              <Row
                label="Slot"
                value={
                  v.matchdayStartTime && v.matchdayEndTime
                    ? `${v.matchdayStartTime} – ${v.matchdayEndTime}`
                    : v.matchdayStartTime || "—"
                }
              />
            </ReviewGroup>

            {/* Round-48 (wizard) — generated matchday calendar folded into
                Review (was its own "Season preview" step). */}
            <ReviewGroup title="Generated calendar" onEdit={() => setStep(2)}>
              <ol className="space-y-1.5 text-sm">
                {planMatchdays({
                  startDate:
                    typeof v.startDate === "string" ? v.startDate : null,
                  endDate: typeof v.endDate === "string" ? v.endDate : null,
                  matchdayCount: Number(v.matchdayCount ?? 0),
                  matchdayStartTime:
                    typeof v.matchdayStartTime === "string"
                      ? v.matchdayStartTime
                      : null,
                  weekdaySchedule: (v.weekdaySchedule ?? []) as Array<{
                    weekday: number;
                    time: string;
                  }>,
                }).map((row) => (
                  <li
                    key={row.number}
                    className="flex items-center justify-between border-b border-border/50 py-1"
                  >
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Matchday {row.number}
                    </span>
                    <span className="font-mono text-xs">
                      {new Date(row.scheduledDate).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ol>
            </ReviewGroup>

            <ReviewGroup
              title="Structure"
              onEdit={() => setStep(3)}
            >
              <ol className="space-y-1.5 text-sm">
                {((v.structureItems ?? []) as StructureItem[]).map((it, i) =>
                  it.kind === "GAME" ? (
                    <li
                      key={it.uid}
                      className="flex items-center justify-between border-b border-border/50 py-1"
                    >
                      <span>
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          #{i + 1}
                        </span>{" "}
                        · {String(it.type).replace("_", " ").toLowerCase()} ·{" "}
                        {Number(it.games)} game
                        {Number(it.games) === 1 ? "" : "s"}
                        {it.raceTo ? ` · race to ${Number(it.raceTo)}` : ""}
                      </span>
                    </li>
                  ) : (
                    <li
                      key={it.uid}
                      className="flex items-center justify-between border-b border-amber-500/30 py-1 text-amber-300"
                    >
                      <span>
                        <span className="text-xs font-bold uppercase tracking-wider">
                          #{i + 1} · Break
                        </span>{" "}
                        · {Number(it.durationMin)} min
                      </span>
                    </li>
                  ),
                )}
              </ol>
              <Row
                label="Break & Run rule"
                value={v.breakAndRunRule ? "ON" : "off"}
              />
            </ReviewGroup>

            <p className="mt-4 rounded-md border border-info/30 bg-info/10 px-3 py-2 text-xs text-info-foreground">
              Confirm &amp; Publish saves the competition as DRAFT. Open
              applications from the competition detail page when you&apos;re ready
              for teams to apply.
            </p>

            {error ? (
              <p className="text-sm text-destructive mt-4" role="alert">
                {error.message}
              </p>
            ) : null}
          </Section>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-6">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 0}
            onClick={prevStep}
            iconBefore={<ArrowLeft className="size-4" />}
          >
            Back
          </Button>
          {step < 4 ? (
            <Button
              type="button"
              onClick={nextStep}
              iconAfter={<ArrowRight className="size-4" />}
            >
              Next
            </Button>
          ) : (
            // Round-48 (wizard) — explicitly type="button" with a click that
            // invokes the submit handler. Letting the browser submit the
            // form via type="submit" caused the bug where stepping into
            // Review (step 4) auto-fired because the trailing mouseup from
            // the previous Next click landed on the freshly-mounted submit
            // button at the same DOM position. Buttons stay type="button"
            // throughout the wizard; the form's onSubmit only runs on this
            // explicit click.
            <Button
              type="button"
              loading={isSubmitting}
              onClick={() => triggerSubmit()}
              iconAfter={<Check className="size-4" />}
              data-testid="confirm-publish"
            >
              {isEdit ? "Save changes" : "Confirm & Publish"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}

/**
 * Round-48 — Figma per-step summary card. Same blue-bordered bullet list
 * shown at the bottom of each Schedule frame; we use it on every step.
 */
function StepSummary({
  bullets,
  testId,
}: {
  bullets: string[];
  testId?: string;
}) {
  if (bullets.length === 0) return null;
  return (
    <div
      data-testid={testId}
      className="rounded-md border border-info/40 bg-info/10 px-4 py-3 text-sm text-info-foreground"
    >
      <ul className="list-disc space-y-1 pl-5">
        {bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
    </div>
  );
}

const WEEKDAY_LABEL: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

function formatTimeHuman(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const hr = Number(m[1]);
  const mins = m[2];
  const period = hr >= 12 ? "PM" : "AM";
  const h12 = hr % 12 === 0 ? 12 : hr % 12;
  return `${h12}:${mins} ${period}`;
}

/** Round-48 — basics-step summary line (Figma per-step confirmation copy). */
function basicsSummary(v: FormInput): string[] {
  const game = GAME_TYPE_TABS.find((g) => g.value === v.gameType)?.label;
  const type = FORMAT_TABS.find((f) => f.value === v.type)?.label;
  const tt = TOURNAMENT_TYPES.find((t) => t.value === v.format)?.title;
  return [
    v.name ? `Competition: ${v.name}` : "Pick a name for the competition.",
    `${game ?? v.gameType ?? "—"} · ${type ?? v.type ?? "—"} · ${tt ?? v.format ?? "—"}`,
    v.prizePool
      ? `Prize: ${v.prizePool}${v.currency ? ` ${v.currency}` : ""}`
      : "Prize not yet set.",
  ];
}

function participantsSummary(v: FormInput): string[] {
  const max = v.maxTeams ? `Max ${v.maxTeams}` : "No cap";
  const min = v.minTeams ?? 2;
  const minP = v.minPlayersPerTeam ?? 1;
  const maxP = v.maxPlayersPerTeam ? ` to ${v.maxPlayersPerTeam}` : "+";
  const mode =
    v.applicationMode === "INVITE_ONLY"
      ? `Invite-only: ${(v.invitedTeamIds ?? []).length} team(s) invited.`
      : "Any team can apply.";
  return [
    mode,
    `${max} participants (min ${min}).`,
    `Team roster size ${minP}${maxP} players.`,
    `Race to ${v.raceToFrames ?? "—"} frames per match.`,
    v.requiresHomeVenue
      ? "Teams must have a home venue to apply."
      : "Teams can apply without a home venue.",
  ];
}

/** Round-48 — Figma Schedule per-step summary bullets. */
function scheduleSummary(v: FormInput): string[] {
  const where =
    v.matchVenueMode === "CENTRAL_VENUE"
      ? "All matches will be played at one central venue"
      : "Each team will play home and away games at Team Venues";
  const gpo =
    Number(v.gamesPerOpponent) === 2
      ? "Games will happen home and away against every other team"
      : "Each team plays each opponent once";
  const slots = (v.weekdaySchedule ?? []) as Array<{
    weekday: number;
    time: string;
  }>;
  const schedLine =
    v.schedulingType === "FIXED_MATCHDAYS"
      ? `Fixed match days will be set after publish (${v.matchdayCount ?? "—"} matchdays)`
      : slots.length
        ? `Games will happen ${slots
            .map(
              (s) =>
                `every ${WEEKDAY_LABEL[s.weekday] ?? "—"} at ${formatTimeHuman(
                  s.time,
                )}`,
            )
            .join(" and ")}`
        : "Add at least one weekday slot to lock the cadence";
  return [
    where,
    gpo,
    schedLine,
    "Season Calendar will be generated after teams confirmed",
  ];
}

function structureSummary(v: FormInput): string[] {
  const items = (v.structureItems ?? []) as StructureItem[];
  const totalGames = items.reduce(
    (n, it) => n + (it.kind === "GAME" ? Number(it.games) || 0 : 0),
    0,
  );
  const breaks = items.filter((it) => it.kind === "BREAK").length;
  const parts: string[] = [];
  for (const it of items) {
    if (it.kind === "GAME") {
      parts.push(
        `${String(it.type).replace("_", " ").toLowerCase()} × ${it.games}`,
      );
    }
  }
  return [
    parts.length
      ? `Match flow: ${parts.join(" → ")}`
      : "Add at least one game block.",
    `Total: ${totalGames} game(s)${breaks ? ` and ${breaks} break(s)` : ""}.`,
    v.breakAndRunRule
      ? "Break & Run rule is ON — running the rack wins the frame."
      : "Break & Run rule is OFF.",
  ];
}

/**
 * Round-48 — Figma "Scheduling Type → Weekly Rounds" weekday/time list with
 * add/remove. weekday is 0–6 matching JS Date.getDay().
 */
function WeekdayListEditor({
  value,
  onChange,
}: {
  value: Array<{ weekday: number; time: string }>;
  onChange: (next: Array<{ weekday: number; time: string }>) => void;
}) {
  function setRow(i: number, patch: Partial<{ weekday: number; time: string }>) {
    onChange(value.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function removeRow(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }
  function addRow() {
    onChange([...value, { weekday: 1, time: "21:00" }]);
  }
  return (
    <div className="space-y-2" data-testid="weekday-list">
      {value.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-secondary/30 px-3 py-3 text-xs text-muted-foreground">
          No weekday slots yet — click <strong>Add Weekday</strong> below.
        </p>
      ) : (
        value.map((row, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
            data-testid={`weekday-row-${i}`}
          >
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Every
            </span>
            <select
              value={String(row.weekday)}
              onChange={(e) =>
                setRow(i, { weekday: Number(e.target.value) })
              }
              className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {WEEKDAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              at
            </span>
            <input
              type="time"
              value={row.time}
              onChange={(e) => setRow(i, { time: e.target.value })}
              className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeRow(i)}
              aria-label={`Remove weekday ${i + 1}`}
            >
              ×
            </Button>
          </div>
        ))
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addRow}
        data-testid="add-weekday"
      >
        + Add Weekday
      </Button>
    </div>
  );
}

// Legacy season-preview helper (unused after the wizard drop). Kept only to
// avoid the diff churn; remove on next pass.
function _SeasonPreviewStepUnused({
  startDate,
  endDate,
  matchdayCount,
  matchdayStartTime,
  onAdjustMatchdayCount,
  onJumpToSchedule,
}: {
  startDate: string | null;
  endDate: string | null;
  matchdayCount: number;
  matchdayStartTime: string | null;
  onAdjustMatchdayCount: (n: number) => void;
  onJumpToSchedule: () => void;
}) {
  const rows = planMatchdays({
    startDate,
    endDate,
    matchdayCount,
    matchdayStartTime,
  });
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-info/30 bg-info/10 px-3 py-2 text-xs text-info-foreground">
        Calendar generated. Review the matchday dates below and confirm.
        These exact dates are what we create when you publish — adjust the
        spacing here or in <button
          type="button"
          onClick={onJumpToSchedule}
          className="font-semibold text-primary hover:underline"
        >
          Schedule
        </button>.
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-card/40 px-3 py-3">
        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-muted-foreground">
            Matchdays
          </span>
          <div className="inline-flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={matchdayCount <= 1}
              onClick={() =>
                onAdjustMatchdayCount(Math.max(1, matchdayCount - 1))
              }
              data-testid="season-preview-decrement"
            >
              −
            </Button>
            <span className="inline-flex h-9 min-w-12 items-center justify-center rounded-md border border-border bg-background px-3 font-mono text-sm font-bold tabular-nums">
              {matchdayCount}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={matchdayCount >= 52}
              onClick={() =>
                onAdjustMatchdayCount(Math.min(52, matchdayCount + 1))
              }
              data-testid="season-preview-increment"
            >
              +
            </Button>
          </div>
        </div>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <span className="block font-medium">Window</span>
          <span className="font-mono">
            {startDate ? formatYmd(String(startDate)) : "TBD"}
            {endDate ? ` → ${formatYmd(String(endDate))}` : " → weekly cadence"}
          </span>
        </div>
        {matchdayStartTime ? (
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <span className="block font-medium">Slot</span>
            <span className="font-mono">{matchdayStartTime}</span>
          </div>
        ) : null}
      </div>

      <ol className="space-y-2" data-testid="season-preview-list">
        {rows.map((md) => {
          const d = new Date(md.scheduledDate);
          return (
            <li
              key={md.number}
              className="flex items-center justify-between rounded-md border border-border bg-background px-4 py-2"
              data-testid={`season-preview-row-${md.number}`}
            >
              <span className="inline-flex items-center gap-3">
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary/15 text-xs font-bold tabular-nums text-primary">
                  {md.number}
                </span>
                <span className="text-sm font-semibold">{md.label}</span>
              </span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {d.toLocaleDateString(undefined, {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
                {matchdayStartTime ? ` · ${matchdayStartTime}` : ""}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
        Team pairings get generated once applications close and you click{" "}
        <strong>Start competition</strong> on the detail page — the dates
        above stay fixed.
      </p>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      {children}
      {hint && !error ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </label>
  );
}

function ReviewGroup({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card px-4 py-3 mb-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs font-semibold text-primary hover:underline"
        >
          Edit
        </button>
      </div>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/50 py-1">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className={"font-medium " + (mono ? "font-mono" : "")}>
        {value || "—"}
      </dd>
    </div>
  );
}

function formatYmd(iso: string) {
  return new Date(iso).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type SegmentedOption<V extends string> = {
  value: V;
  label: string;
  soon?: boolean;
};

function SegmentedTabs<V extends string>({
  value,
  onValueChange,
  options,
  testIdPrefix,
}: {
  value: V;
  onValueChange: (v: V) => void;
  options: SegmentedOption<V>[];
  testIdPrefix: string;
}) {
  return (
    <div
      role="tablist"
      className="flex items-stretch gap-1 rounded-md border border-border bg-secondary/30 p-1"
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={opt.soon}
            onClick={() => !opt.soon && onValueChange(opt.value)}
            data-testid={`${testIdPrefix}-${opt.value.toLowerCase()}`}
            className={cn(
              "relative flex-1 rounded-[4px] px-3 py-2 text-sm font-semibold transition-colors",
              selected
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              opt.soon && "cursor-not-allowed opacity-60",
            )}
          >
            {opt.label}
            {opt.soon ? (
              <span className="ml-1.5 inline-flex items-center rounded-sm bg-info/20 px-1 text-[10px] font-bold uppercase tracking-wider text-info">
                Soon
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function TournamentTypeCard({
  option,
  selected,
  onSelect,
}: {
  option: TournamentTypeOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={option.soon}
      onClick={onSelect}
      data-testid={`comp-tournament-type-${option.value.toLowerCase()}`}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors",
        selected
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:border-border/80",
        option.soon && "cursor-not-allowed opacity-70 hover:border-border",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2",
          selected
            ? "border-primary bg-primary"
            : "border-muted-foreground/40 bg-transparent",
        )}
      >
        {selected ? (
          <Check className="size-3 text-primary-foreground" />
        ) : null}
      </span>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{option.title}</span>
          {option.soon ? (
            <span className="inline-flex items-center rounded-sm bg-info/20 px-1 py-0.5 text-[10px] font-bold uppercase tracking-wider text-info">
              Coming Soon
            </span>
          ) : null}
        </div>
        <ul className="ml-4 list-disc text-xs text-muted-foreground">
          {option.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </div>
    </button>
  );
}

const DateInput = (() => {
  // Round-48 — calendar icon moved to the RIGHT edge per user feedback (was
  // a leading icon, which doubled the visual weight against the native
  // picker indicator). Bigger icon (size-5) so it reads as a tap target.
  // `pointer-events-none` keeps the native date picker reachable through
  // the icon — the input's right-side native indicator is hidden via the
  // existing globals.css rule (`::-webkit-calendar-picker-indicator`).
  type DateInputProps = React.InputHTMLAttributes<HTMLInputElement>;
  function Inner(
    props: DateInputProps,
    ref: React.ForwardedRef<HTMLInputElement>,
  ) {
    return (
      <div className="relative">
        <Input
          type="date"
          ref={ref}
          {...props}
          className={cn("pr-10", props.className)}
        />
        <CalendarDays
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground"
          aria-hidden
        />
      </div>
    );
  }
  Inner.displayName = "DateInput";
  return React.forwardRef<HTMLInputElement, DateInputProps>(Inner);
})();

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
