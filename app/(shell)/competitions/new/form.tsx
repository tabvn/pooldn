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
const SCHEDULING_TYPES = ["FIXED_DATE", "FLEXIBLE", "AUTO_GENERATED"] as const;

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

const STEPS = [
  { title: "Basics", desc: "Name, game, format, tournament type, start date and prize." },
  { title: "Participants", desc: "Team and player counts." },
  { title: "Schedule", desc: "City, scheduling and matchday slots." },
  { title: "Structure", desc: "Match builder + rules (Break & Run)." },
  { title: "Season preview", desc: "Review the auto-generated matchday calendar." },
  { title: "Review & Publish", desc: "Confirm everything before you publish." },
] as const;

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5;
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
  ],
  2: [
    "cityId",
    "schedulingType",
    "endDate",
    "matchdayCount",
    "matchdayStartTime",
    "matchdayEndTime",
    "maxGamesPerVenuePerMatchday",
  ],
  3: ["structureItems", "breakAndRunRule"],
  // Step 4 — Season preview. Schedule fields already validated at step 2;
  // the preview is read-only over them, so no additional triggers here.
  4: [],
  5: [],
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
    if (!ok) return;
    setStep((s) => (Math.min(s + 1, 5) as StepIndex));
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

  const onSubmit = handleSubmit(async (values) => {
    // Guard: Enter inside any earlier-step input must NOT skip Review.
    // Without this the form auto-submits on first Enter and the Review step
    // is never reached.
    if (step !== 5) return;
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

          {/* Progress dots */}
          <ol className="flex items-center gap-2" aria-label="Wizard progress">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex-1">
                <button
                  type="button"
                  onClick={() => i < step && setStep(i as StepIndex)}
                  disabled={i > step}
                  className={
                    "block w-full h-1.5 rounded-full transition-colors " +
                    (i < step
                      ? "bg-black cursor-pointer"
                      : i === step
                        ? "bg-black"
                        : "bg-black/20")
                  }
                  aria-label={`Step ${i + 1}: ${s.title}`}
                />
              </li>
            ))}
          </ol>
        </div>
      </header>

      <form
        id="new-comp"
        onSubmit={onSubmit}
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
          </Section>
        )}

        {step === 2 && (
          <Section>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Scheduling">
                <Controller
                  control={control}
                  name="schedulingType"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) =>
                        field.onChange(v as (typeof SCHEDULING_TYPES)[number])
                      }
                      options={SCHEDULING_TYPES.map((v) => ({
                        value: v,
                        label: v.replace(/_/g, " ").toLowerCase(),
                      }))}
                    />
                  )}
                />
              </Field>
              <Field label="City (optional)">
                <Controller
                  control={control}
                  name="cityId"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      placeholder="— none —"
                      options={[
                        {
                          value: "",
                          label: (
                            <span className="text-muted-foreground">— none —</span>
                          ),
                        },
                        ...cities.map((c) => ({
                          value: c.id,
                          label: `${c.name}, ${c.country.name}`,
                        })),
                      ]}
                    />
                  )}
                />
              </Field>
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
              <Field
                label="End date (optional)"
                error={errors.endDate?.message}
              >
                <DateInput {...register("endDate")} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Matchday start">
                  <Input type="time" {...register("matchdayStartTime")} />
                </Field>
                <Field label="Matchday end">
                  <Input type="time" {...register("matchdayEndTime")} />
                </Field>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              <Field label="Currency">
                <Input defaultValue="VND" {...register("currency")} />
              </Field>
            </div>
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
                </div>
              );
            }}
          />
        )}

        {step === 4 && (
          <Section>
            <SeasonPreviewStep
              startDate={
                typeof v.startDate === "string" ? v.startDate : null
              }
              endDate={typeof v.endDate === "string" ? v.endDate : null}
              matchdayCount={Number(v.matchdayCount ?? 0)}
              matchdayStartTime={
                typeof v.matchdayStartTime === "string"
                  ? v.matchdayStartTime
                  : null
              }
              onAdjustMatchdayCount={(n) =>
                setValue("matchdayCount", n, { shouldValidate: true })
              }
              onJumpToSchedule={() => setStep(2)}
            />
          </Section>
        )}

        {step === 5 && (
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
                label="Scheduling"
                value={String(v.schedulingType ?? "").replace(/_/g, " ").toLowerCase()}
              />
              <Row label="Matchdays" value={Number(v.matchdayCount ?? 0)} />
              <Row
                label="Slot"
                value={
                  v.matchdayStartTime && v.matchdayEndTime
                    ? `${v.matchdayStartTime} – ${v.matchdayEndTime}`
                    : v.matchdayStartTime || "—"
                }
              />
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
          {step < 5 ? (
            <Button
              type="button"
              onClick={nextStep}
              iconAfter={<ArrowRight className="size-4" />}
            >
              Next
            </Button>
          ) : (
            <Button
              type="submit"
              loading={isSubmitting}
              iconAfter={<Check className="size-4" />}
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
 * Round-47 — wizard Step 4 "Season preview". Read-only over the Schedule
 * step's inputs, runs the same date-distribution math the post-publish
 * `generateMatchdays` mutation uses, so what the organizer sees here is
 * what they get after Confirm & Publish. Includes a quick "+/-" pair to
 * tune the matchday count without bouncing back to Schedule.
 */
function SeasonPreviewStep({
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
  // Wrap the date input with a leading calendar icon so the field reads as
  // a date picker even on browsers that hide the native indicator under our
  // dark theme. Forwarded ref keeps it RHF-register compatible.
  type DateInputProps = React.InputHTMLAttributes<HTMLInputElement>;
  function Inner(
    props: DateInputProps,
    ref: React.ForwardedRef<HTMLInputElement>,
  ) {
    return (
      <div className="relative">
        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          type="date"
          ref={ref}
          {...props}
          className={cn("pl-10", props.className)}
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
