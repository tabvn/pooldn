"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { Check, Info, Trophy } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { CreateCompetitionMutation } from "@/lib/graphql/operations/competition-mutations.operations";
import type {
  CompetitionFormat,
  CompetitionType,
  GameType,
} from "@/lib/generated/prisma/enums";

/**
 * Round-51 — Figma "Create New Competition" basics screen.
 *
 * Captures only the seven fields shown in the design: name, description,
 * game type, format, tournament type, start date, and (optional) prize.
 * After create the captain lands on the 4-tab draft editor at
 * /competitions/{slug}/edit (Participants · Structure · Schedule · Review).
 *
 * Game type and Format expose their full enum but lock the "coming soon"
 * options with a badge — matches the design's Beta-style messaging. The
 * "Tournament Type" radio cards behave the same way: only League/Round
 * Robin is enabled today; SE/DE show a Coming-Soon badge.
 */

type GameOption = { value: GameType; label: string; soon?: boolean };
type FormatOption = { value: CompetitionType; label: string; soon?: boolean };
type TournamentOption = {
  value: CompetitionFormat;
  label: string;
  bullets: string[];
  soon?: boolean;
};

const GAME_OPTIONS: GameOption[] = [
  { value: "EIGHT_BALL", label: "8-Ball" },
  { value: "NINE_BALL", label: "9-Ball" },
  { value: "TEN_BALL", label: "10-Ball" },
];

// Round-53/55 — CompetitionType has three values total, but only TEAMS is
// fully wired for MVP. Singles + Doubles stay visible behind a Coming-Soon
// badge so organisers know the shape we're heading toward; the segmented
// toggle won't let them pick those yet.
const FORMAT_OPTIONS: FormatOption[] = [
  { value: "TEAMS", label: "Teams" },
  { value: "INDIVIDUAL", label: "Singles" },
  { value: "DOUBLES", label: "Doubles (2v2)", soon: true },
];

const TOURNAMENT_OPTIONS: TournamentOption[] = [
  {
    value: "ROUND_ROBIN",
    label: "League (Round-Robin)",
    bullets: [
      "Everyone plays everyone",
      "Organizer chooses 1 round (Round Robin) or multiple rounds (League-style)",
      "Standings based on points",
      "Works for both short groups and longer seasons",
    ],
  },
  {
    value: "SINGLE_ELIMINATION",
    label: "Single Elimination (Knockout)",
    bullets: [
      "Lose once = out",
      "Random draw into a knockout bracket",
      "Fast bracket, ideal for quick tournaments",
    ],
  },
  {
    value: "DOUBLE_ELIMINATION",
    label: "Double Elimination",
    soon: true,
    bullets: [
      "Players get a second chance",
      "Has Winners & Losers bracket",
      "Ends with Grand Final (with possible bracket reset)",
    ],
  },
];

const schema = z.object({
  name: z.string().min(2, "Give your competition a name").max(120),
  description: z.string().max(2000).optional(),
  gameType: z.enum(["EIGHT_BALL", "NINE_BALL", "TEN_BALL", "STRAIGHT_POOL"]),
  type: z.enum(["TEAMS", "INDIVIDUAL", "DOUBLES"]),
  format: z.enum([
    "ROUND_ROBIN",
    "SINGLE_ELIMINATION",
    "DOUBLE_ELIMINATION",
    "SWISS",
  ]),
  startDate: z.string().min(1, "Pick a start date"),
  prizePool: z.string().optional(),
  currency: z.string(),
});

type FormValues = z.infer<typeof schema>;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export function BasicsForm() {
  const router = useRouter();
  const toast = useToast();
  const [create, { loading }] = useMutation(CreateCompetitionMutation);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      gameType: "EIGHT_BALL",
      type: "TEAMS",
      format: "ROUND_ROBIN",
      startDate: "",
      prizePool: "",
      currency: "VND",
    },
  });

  const gameType = watch("gameType");
  const type = watch("type");
  const format = watch("format");

  // Round-51 — slug auto-derives from the name so the URL is human-friendly
  // (and unique enough — duplicates get a random suffix via the resolver).
  const [slugTouched] = useState(false);
  const name = watch("name");
  const slug = slugTouched ? "" : slugify(name);

  const onSubmit = handleSubmit(async (values) => {
    if (!slug) {
      toast.error("Name required", "We use it to build the competition URL.");
      return;
    }
    try {
      const startDate = values.startDate
        ? new Date(`${values.startDate}T00:00:00`).toISOString()
        : null;
      const result = await create({
        variables: {
          input: {
            name: values.name.trim(),
            slug: `${slug}-${Math.random().toString(36).slice(2, 6)}`,
            description: values.description?.trim() || null,
            gameType: values.gameType,
            type: values.type,
            format: values.format,
            startDate,
            prizePool: values.prizePool?.trim() || null,
            currency: values.currency,
          },
        },
      });
      const created = result.data?.createCompetition;
      if (!created) throw new Error("Could not create competition");
      toast.success("Competition Draft has been created");
      // Details are prefilled from this form, so land the organizer on the
      // Participants tab to continue setup. (Editing later opens on Details.)
      router.push(`/competitions/${created.slug}/edit?tab=participants`);
      router.refresh();
    } catch (e) {
      toast.error(
        "Could not create",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-4 py-10">
      {/* Title */}
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Create New Competition
        </h1>
        <p className="text-sm text-muted-foreground">
          Set up the core details of your competition
        </p>
      </div>

      {/* Card */}
      <form
        id="basics"
        onSubmit={onSubmit}
        className="w-full space-y-4 rounded-2xl border border-border bg-card p-6"
      >
        {/* Name */}
        <Field label="Competition Name" error={errors.name?.message}>
          <input
            {...register("name")}
            placeholder="Competition Name"
            className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            data-testid="basics-name"
          />
        </Field>

        {/* Description */}
        <Field
          label="Description (optional)"
          error={errors.description?.message}
        >
          <textarea
            {...register("description")}
            rows={4}
            placeholder="Tell us more about your competition"
            className="block w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            data-testid="basics-description"
          />
        </Field>

        {/* Game Type — segmented */}
        <Field label="Game Type">
          <SegmentedToggle
            value={gameType}
            options={GAME_OPTIONS}
            onSelect={(v) => setValue("gameType", v as GameType)}
            testIdPrefix="basics-game"
          />
        </Field>

        {/* Format — segmented (drives CompetitionType: TEAMS / INDIVIDUAL /
            DOUBLES). Each value steers the Round-53 apply flow to a
            different gate. */}
        <Field label="Format">
          <SegmentedToggle
            value={type}
            options={FORMAT_OPTIONS}
            onSelect={(v) => setValue("type", v as CompetitionType)}
            testIdPrefix="basics-format"
          />
        </Field>

        {/* Tournament Type — radio cards */}
        <Field label="Tournament Type">
          <div className="space-y-1.5">
            {TOURNAMENT_OPTIONS.map((opt) => {
              const checked = format === opt.value;
              const disabled = opt.soon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => !disabled && setValue("format", opt.value)}
                  data-active={checked || undefined}
                  data-testid={`basics-tournament-${opt.value}`}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors",
                    checked
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background",
                    disabled
                      ? "cursor-not-allowed opacity-60"
                      : "hover:border-primary/40",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border",
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background",
                    )}
                  >
                    {checked ? <Check className="size-3" /> : null}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{opt.label}</span>
                      {opt.soon ? <ComingSoon /> : null}
                    </div>
                    <ul className="ml-4 list-disc space-y-0.5 text-xs text-muted-foreground">
                      {opt.bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  </div>
                </button>
              );
            })}
          </div>
        </Field>

        {/* Start Date — color-scheme:dark forces the browser's native
            calendar UI (and picker icon) into the dark palette so it
            stays legible on the card background. Without it Chrome on
            macOS shows a near-invisible white-on-white icon. */}
        <Field
          label="Competition Start Date"
          error={errors.startDate?.message}
        >
          <input
            type="date"
            {...register("startDate")}
            className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary [color-scheme:dark]"
            data-testid="basics-startdate"
          />
        </Field>

        {/* Prize + currency — same control as the Edit competition Details tab. */}
        <Field label="Prize (Optional)">
          <div className="flex items-stretch gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-background px-3">
              <Trophy className="size-4 text-muted-foreground" />
              <input
                {...register("prizePool")}
                inputMode="numeric"
                placeholder="e.g. 10,000,000"
                className="block w-full bg-transparent py-2 text-sm outline-none"
                data-testid="basics-prize"
              />
            </div>
            <select
              {...register("currency")}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              data-testid="basics-currency"
            >
              <option value="VND">VND</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </Field>

        {/* After-creating helper */}
        <div className="flex items-start gap-3 rounded-md border border-info/40 bg-info/10 p-3 text-sm text-info">
          <Info className="mt-0.5 size-4 shrink-0" />
          <div>
            <div className="font-semibold">After creating, you will be able to:</div>
            <ul className="ml-4 mt-1 list-disc space-y-0.5 text-xs">
              <li>Access the competition screen</li>
              <li>Set up competition rules</li>
              <li>Be able to manage participants and matches</li>
            </ul>
          </div>
        </div>

        {/* Primary CTA */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="w-full"
          data-testid="basics-create"
        >
          Create Competition
        </Button>
      </form>

      <div className="border-t border-border pt-4">
        <Link href="/competitions">
          <Button variant="outline">Cancel</Button>
        </Link>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-muted-foreground">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function SegmentedToggle({
  value,
  options,
  onSelect,
  testIdPrefix,
}: {
  value: string;
  options: ReadonlyArray<{ value: string; label: string; soon?: boolean }>;
  onSelect: (v: string) => void;
  testIdPrefix: string;
}) {
  return (
    <div className="flex items-stretch gap-1 rounded-md border border-border bg-background p-1">
      {options.map((opt) => {
        const checked = value === opt.value;
        const disabled = opt.soon;
        return (
          <button
            key={`${opt.label}-${opt.value}`}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onSelect(opt.value)}
            data-active={checked || undefined}
            data-testid={`${testIdPrefix}-${opt.value}`}
            className={cn(
              "relative flex-1 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
              checked
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary/50",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <span>{opt.label}</span>
            {opt.soon ? (
              <span className="ml-2 inline-flex items-center rounded-md bg-primary/15 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                Soon
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function ComingSoon() {
  return (
    <span className="inline-flex items-center rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
      Coming Soon
    </span>
  );
}
