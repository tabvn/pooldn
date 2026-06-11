"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@apollo/client/react";
import { AlertCircle, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TeamsListQuery,
  TeamDetailQuery,
} from "@/lib/graphql/operations/team.operations";
import { ApplyToCompetitionMutation } from "@/lib/graphql/operations/competition-mutations.operations";
import {
  CompetitionHeaderQuery,
  ViewerQuery,
} from "@/lib/graphql/operations/competition.operations";
import { RosterConflictsQuery } from "@/lib/graphql/operations/roster.operations";

const schema = z.object({
  teamId: z.string().min(1, "Pick a team"),
  playerUserIds: z.array(z.string()),
  rosterCaptainUserId: z.string().optional(),
  message: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// Round-48 — five steps. The Roster Captain step is rendered only when the
// team captain isn't in the selected roster (auto-detected); the navigation
// helpers skip past it transparently when not applicable.
type StepIndex = 0 | 1 | 2 | 3 | 4;
const STEPS = [
  { title: "Choose team", desc: "Select the team you want to enter." },
  { title: "Roster", desc: "Pick the players who will compete." },
  {
    title: "Roster Captain",
    desc:
      "Since you're not participating, select a player to act as captain for this competition (manage lineups and confirm results).",
  },
  { title: "Message", desc: "Optional note to the organizer." },
  { title: "Review & Send", desc: "Confirm everything and send to the organizer." },
] as const;

const STEP_TEAM = 0 as const;
const STEP_ROSTER = 1 as const;
const STEP_ROSTER_CAPTAIN = 2 as const;
const STEP_MESSAGE = 3 as const;
const STEP_REVIEW = 4 as const;

export function ApplyForm({
  slug,
  initialTeamId,
}: {
  slug: string;
  initialTeamId?: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<StepIndex>(STEP_TEAM);
  const compQuery = useQuery(CompetitionHeaderQuery, { variables: { slug } });
  const teamsQuery = useQuery(TeamsListQuery);
  const viewerQuery = useQuery(ViewerQuery, { errorPolicy: "ignore" });
  const [selectedTeamId, setSelectedTeamId] = useState<string>(initialTeamId ?? "");
  const teamDetailQuery = useQuery(TeamDetailQuery, {
    variables: { slug: teamForSlug(teamsQuery.data?.teams, selectedTeamId) ?? "" },
    skip: !selectedTeamId,
  });
  const [apply, { error, loading: applying }] = useMutation(
    ApplyToCompetitionMutation,
  );
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      teamId: "",
      playerUserIds: [],
      rosterCaptainUserId: "",
      message: "",
    },
  });

  const competition = compQuery.data?.competition;
  // Round-43 — restrict the dropdown to teams the viewer actually captains.
  // The server already enforces this on applyToCompetition; the UI shouldn't
  // tease teams the viewer can't actually use. SUPER_ADMIN sees all teams
  // so they can apply on behalf of any captain.
  const viewerId = viewerQuery.data?.viewer?.id;
  const isAdmin = viewerQuery.data?.viewer?.role === "SUPER_ADMIN";
  const allTeams = teamsQuery.data?.teams ?? [];
  const teams = isAdmin
    ? allTeams
    : allTeams.filter((t) => t.captain?.id === viewerId);
  const team = teamDetailQuery.data?.team;
  const roster = team?.members ?? [];
  const conflictsQuery = useQuery(RosterConflictsQuery, {
    variables: {
      competitionId: competition?.id ?? "",
      excludeTeamId: watch("teamId") || null,
    },
    skip: !competition?.id,
    fetchPolicy: "cache-and-network",
  });
  const conflictMap = new Map(
    (conflictsQuery.data?.rosterConflicts ?? []).map((c) => [c.userId, c]),
  );

  const minPlayers = competition?.minPlayersPerTeam ?? 1;
  const maxPlayers = competition?.maxPlayersPerTeam ?? (roster.length || 99);
  const watchedTeamId = watch("teamId");
  const selectedPlayers = watch("playerUserIds") ?? [];
  const watchedRosterCaptain = watch("rosterCaptainUserId") ?? "";

  // Sync the local team id used to drive the roster fetch
  if (watchedTeamId !== selectedTeamId) {
    setSelectedTeamId(watchedTeamId);
    setValue("playerUserIds", []);
    setValue("rosterCaptainUserId", "");
  }

  // Round-49 — pre-select the team when the captain landed here via an
  // invite accept link (?teamId=…). Wait for the viewer's team list to
  // load so we can verify they actually captain that team — admins skip
  // the check (they can apply on anyone's behalf).
  useEffect(() => {
    if (!initialTeamId || watchedTeamId) return;
    if (!teamsQuery.data) return;
    const inViewerTeams = teams.some((t) => t.id === initialTeamId);
    if (inViewerTeams || isAdmin) {
      setValue("teamId", initialTeamId, { shouldValidate: true });
    }
    // Intentional: run when the deps below change. We don't want to
    // re-seed if the captain manually picks a different team.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTeamId, teamsQuery.data, isAdmin]);

  const togglePlayer = (id: string) => {
    const cur = new Set(selectedPlayers);
    cur.has(id) ? cur.delete(id) : cur.add(id);
    const next = Array.from(cur);
    setValue("playerUserIds", next, { shouldValidate: true });
    // If the previously-chosen Roster Captain got unchecked, clear them
    // so the Review step shows the empty state and the next-step guard
    // forces a re-pick.
    if (watchedRosterCaptain && !cur.has(watchedRosterCaptain)) {
      setValue("rosterCaptainUserId", "");
    }
  };

  // Round-48 — Roster Captain is required when the team captain isn't in
  // the playing roster. The corresponding step appears only in that case.
  const teamCaptainId = team?.captain?.id ?? null;
  const captainIsPlaying = Boolean(
    teamCaptainId && selectedPlayers.includes(teamCaptainId),
  );
  const needsRosterCaptain = Boolean(
    teamCaptainId && selectedPlayers.length > 0 && !captainIsPlaying,
  );

  // Round-48 — block submission when the competition gates on a home venue
  // and the selected team doesn't have one set.
  const requiresHomeVenue = Boolean(competition?.requiresHomeVenue);
  const homeVenueMissing = requiresHomeVenue && !team?.homeVenue;

  const rosterPlayers = useMemo(
    () =>
      roster.filter((m) => selectedPlayers.includes(m.user.id)).map((m) => m.user),
    [roster, selectedPlayers],
  );

  function isStepDisabled(s: StepIndex) {
    // Hide Roster Captain step when not needed; navigation skips past it.
    return s === STEP_ROSTER_CAPTAIN && !needsRosterCaptain;
  }

  function nextStep() {
    if (step === STEP_TEAM) {
      if (!watchedTeamId) return;
      if (homeVenueMissing) return;
    }
    if (step === STEP_ROSTER) {
      if (selectedPlayers.length < minPlayers) return;
    }
    if (step === STEP_ROSTER_CAPTAIN && needsRosterCaptain && !watchedRosterCaptain) {
      return;
    }
    let next: StepIndex = Math.min(step + 1, STEP_REVIEW) as StepIndex;
    while (isStepDisabled(next) && next < STEP_REVIEW) {
      next = (next + 1) as StepIndex;
    }
    setStep(next);
  }
  function prevStep() {
    let prev: StepIndex = Math.max(step - 1, STEP_TEAM) as StepIndex;
    while (isStepDisabled(prev) && prev > STEP_TEAM) {
      prev = (prev - 1) as StepIndex;
    }
    setStep(prev);
  }

  const onSubmit = handleSubmit(async (values) => {
    // Gate the actual mutation to the Review step — pressing Enter inside
    // an earlier-step input must not skip ahead.
    if (step !== STEP_REVIEW) return;
    if (!competition) return;
    if (homeVenueMissing) return;
    if (needsRosterCaptain && !values.rosterCaptainUserId) return;
    try {
      const result = await apply({
        variables: {
          input: {
            competitionId: competition.id,
            teamId: values.teamId,
            message: values.message || null,
            playerUserIds: values.playerUserIds,
            rosterCaptainUserId: values.rosterCaptainUserId || null,
          },
        },
      });
      if (result.data?.applyToCompetition) {
        // Round-50 — accepting an organizer invite auto-approves, so the
        // toast reflects the actual outcome instead of always saying
        // "submitted, will review".
        if (result.data.applyToCompetition.status === "APPROVED") {
          toast.success(
            "You're in",
            "Your team is on the competition list.",
          );
        } else {
          toast.success(
            "Application submitted",
            "The organizer will review it.",
          );
        }
        router.push(`/competitions/${slug}`);
        router.refresh();
      }
    } catch (e) {
      toast.error(
        "Could not apply",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  });

  const selectedTeam = teams.find((t) => t.id === watchedTeamId);
  const watchedMessage = watch("message");
  const visibleSteps = STEPS.filter(
    (_, i) => !isStepDisabled(i as StepIndex),
  );

  // Round-49 — Apply-gate panel. Replaces the silent server-side redirect
  // when the captain hits this page via an invite link but can't actually
  // file an application right now (comp not open yet, already approved,
  // declined and the row's still PENDING, etc).
  const gate = computeApplyGate({
    competitionStatus: competition?.status ?? null,
    viewerCanApply: competition?.viewerCanApply ?? false,
    isAdmin,
    application: competition?.myTeamApplication ?? null,
  });
  if (competition && gate) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>{gate.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{gate.description}</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
              <AlertCircle className="mt-0.5 size-4 text-warning" />
              <div className="space-y-1">
                <div className="font-medium">{gate.detail}</div>
                {gate.hint ? (
                  <div className="text-xs text-muted-foreground">{gate.hint}</div>
                ) : null}
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Link href={`/competitions/${slug}`}>
              <Button variant="ghost">
                <ArrowLeft className="size-4" />
                Back to competition
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>
            Apply to {competition?.name ?? "competition"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Step {visibleSteps.findIndex((s) => s.title === STEPS[step].title) + 1}{" "}
            of {visibleSteps.length} · {STEPS[step].desc}
          </p>
          <ol
            className="mt-3 flex items-center gap-2"
            aria-label="Apply progress"
          >
            {visibleSteps.map((s, i) => {
              const myStepIndex = STEPS.findIndex((x) => x.title === s.title);
              const currentVisibleIndex = visibleSteps.findIndex(
                (x) => x.title === STEPS[step].title,
              );
              return (
                <li key={s.title} className="flex-1">
                  <div
                    className={
                      "h-1.5 rounded-full transition-colors " +
                      (i <= currentVisibleIndex ? "bg-primary" : "bg-secondary")
                    }
                    aria-label={`Step ${i + 1}${myStepIndex === step ? " (current)" : ""}`}
                  />
                </li>
              );
            })}
          </ol>
        </CardHeader>
        <CardContent>
          {/* Round-49 — never let the form auto-submit. Pressing Enter in an
              earlier-step input (or React swapping a type="button" Next slot
              for a type="submit" Confirm slot mid-click) used to slip past
              the step guard and fire applyToCompetition. We now block the
              native submit entirely; only the explicit Confirm & Send
              onClick below ever invokes onSubmit. */}
          <form
            id="apply"
            onSubmit={(e) => {
              e.preventDefault();
            }}
            className="space-y-5"
          >
            {/* Step 1 — Team selector + requiresHomeVenue gate */}
            {step === STEP_TEAM ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="teamId">Team</Label>
                  <select
                    id="teamId"
                    {...register("teamId")}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    disabled={teams.length === 0}
                  >
                    <option value="">
                      {teams.length === 0
                        ? "You don't captain any teams yet"
                        : "Select a team you captain…"}
                    </option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {errors.teamId ? (
                    <p className="text-xs text-destructive">
                      {errors.teamId.message}
                    </p>
                  ) : null}
                </div>

                {/* Home venue display when the team has one — informational. */}
                {team?.homeVenue ? (
                  <div className="rounded-md border border-border bg-background px-3 py-2 text-sm">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      Home venue
                    </div>
                    <div className="font-medium">
                      {team.homeVenue.name} · {team.homeVenue.city.name}
                    </div>
                  </div>
                ) : null}

                {/* Round-48 — required-home-venue gate (Figma verbatim copy). */}
                {homeVenueMissing && team ? (
                  <div
                    role="alert"
                    data-testid="home-venue-required"
                    className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm text-destructive"
                  >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <div className="space-y-1">
                      <div className="font-semibold">
                        This competition requires each team to have a home venue.
                      </div>
                      <Link
                        href={`/teams/${team.slug}/manage`}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-1 text-xs font-medium underline"
                      >
                        Set a home venue for {team.name} →
                      </Link>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {/* Step 2 — Roster */}
            {step === STEP_ROSTER ? (
              <div className="space-y-1.5">
                <Label>Select roster</Label>
                <p className="text-xs text-muted-foreground">
                  Select {minPlayers} to {maxPlayers} players who will compete.
                </p>
                {!selectedTeamId ? (
                  <p className="rounded-md border border-dashed border-border bg-secondary/30 px-3 py-4 text-xs text-muted-foreground">
                    Pick a team to see its roster.
                  </p>
                ) : roster.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border bg-secondary/30 px-3 py-4 text-xs text-muted-foreground">
                    This team has no members yet.
                  </p>
                ) : (
                  <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {roster.map((m) => {
                      const checked = selectedPlayers.includes(m.user.id);
                      const conflict = conflictMap.get(m.user.id);
                      const disabled = Boolean(conflict);
                      const isCaptain = m.user.id === teamCaptainId;
                      return (
                        <li key={m.id}>
                          <label
                            className={
                              "flex items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm transition-colors " +
                              (disabled
                                ? "cursor-not-allowed opacity-60 border-border"
                                : "cursor-pointer ") +
                              (!disabled && checked
                                ? "border-primary/60 bg-primary/5"
                                : !disabled
                                  ? "border-border hover:border-primary/30"
                                  : "")
                            }
                            aria-disabled={disabled}
                            data-testid={
                              disabled ? `roster-conflict-${m.user.id}` : undefined
                            }
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={() =>
                                !disabled && togglePlayer(m.user.id)
                              }
                              className="size-4 accent-primary"
                            />
                            <Avatar
                              size="sm"
                              src={m.user.avatarUrl ?? undefined}
                              fallback={m.user.name}
                            />
                            <div className="flex flex-col">
                              <span className="font-semibold">
                                {m.user.name}
                                {isCaptain ? (
                                  <Badge
                                    variant="primary"
                                    size="sm"
                                    className="ml-2"
                                  >
                                    Captain
                                  </Badge>
                                ) : null}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                @{m.user.username}
                                {m.user.nationality
                                  ? ` · ${m.user.nationality}`
                                  : ""}
                              </span>
                              {conflict ? (
                                <span className="mt-1 text-[11px] font-medium text-amber-400">
                                  Already on {conflict.teamName} (
                                  {conflict.status.toLowerCase()})
                                </span>
                              ) : null}
                            </div>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="text-xs">
                  <Badge
                    variant={
                      selectedPlayers.length === 0
                        ? "neutral"
                        : selectedPlayers.length < minPlayers
                          ? "warning"
                          : "success"
                    }
                    size="sm"
                  >
                    {selectedPlayers.length} selected
                  </Badge>
                </div>
              </div>
            ) : null}

            {/* Step 3 — Roster Captain (conditional). */}
            {step === STEP_ROSTER_CAPTAIN ? (
              <div className="space-y-3" data-testid="roster-captain-step">
                <Label>Select a Roster Captain</Label>
                <p className="text-xs text-muted-foreground">
                  Since you're not participating, select a player to act as
                  captain for this competition (manage lineups and confirm
                  results).
                </p>
                <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {rosterPlayers.map((u) => {
                    const checked = watchedRosterCaptain === u.id;
                    return (
                      <li key={u.id}>
                        <label
                          className={
                            "flex items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm transition-colors cursor-pointer " +
                            (checked
                              ? "border-primary/60 bg-primary/5"
                              : "border-border hover:border-primary/30")
                          }
                        >
                          <input
                            type="radio"
                            name="rosterCaptainUserId"
                            value={u.id}
                            checked={checked}
                            onChange={() =>
                              setValue("rosterCaptainUserId", u.id, {
                                shouldValidate: true,
                              })
                            }
                            className="size-4 accent-primary"
                          />
                          <Avatar
                            size="sm"
                            src={u.avatarUrl ?? undefined}
                            fallback={u.name}
                          />
                          <div className="flex flex-col">
                            <span className="font-semibold">{u.name}</span>
                            <span className="text-xs text-muted-foreground">
                              @{u.username}
                            </span>
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {/* Step 4 — Message */}
            {step === STEP_MESSAGE ? (
              <div className="space-y-1.5">
                <Label htmlFor="message">Message to organizer (optional)</Label>
                <Input id="message" {...register("message")} />
                <p className="text-xs text-muted-foreground">
                  Tell the organizer anything they should know about your team.
                </p>
              </div>
            ) : null}

            {/* Step 5 — Review & Send */}
            {step === STEP_REVIEW ? (
              <div className="space-y-3" data-testid="apply-review">
                <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Competition
                  </div>
                  <div className="mt-0.5 font-semibold">
                    {competition?.name ?? "—"}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {competition?.format ? (
                      <Badge variant="primary" size="sm">
                        {String(competition.format)
                          .replace(/_/g, " ")
                          .toLowerCase()}
                      </Badge>
                    ) : null}
                    {competition?.gameType ? (
                      <Badge variant="neutral" size="sm">
                        {String(competition.gameType)
                          .replace("_", "-")
                          .toLowerCase()}
                      </Badge>
                    ) : null}
                    {competition?.startDate ? (
                      <span>
                        Starts{" "}
                        {new Date(competition.startDate).toLocaleDateString()}
                      </span>
                    ) : null}
                  </div>
                </div>
                <ReviewRow
                  label="Team"
                  value={selectedTeam?.name ?? "—"}
                  onEdit={() => setStep(STEP_TEAM)}
                />
                <ReviewRow
                  label="Roster"
                  value={
                    selectedPlayers.length === 0
                      ? "Will use the full team roster"
                      : `${selectedPlayers.length} players selected`
                  }
                  onEdit={() => setStep(STEP_ROSTER)}
                />
                {needsRosterCaptain ? (
                  <ReviewRow
                    label="Roster Captain"
                    value={
                      rosterPlayers.find((u) => u.id === watchedRosterCaptain)
                        ?.name ?? "Not selected"
                    }
                    onEdit={() => setStep(STEP_ROSTER_CAPTAIN)}
                  />
                ) : null}
                <ReviewRow
                  label="Message"
                  value={watchedMessage ? watchedMessage : "—"}
                  onEdit={() => setStep(STEP_MESSAGE)}
                />
                <p className="mt-2 rounded-md border border-info/30 bg-info/10 px-3 py-2 text-xs text-info-foreground">
                  Hit <strong>Confirm &amp; Send</strong> to deliver your
                  application to the organizer. They'll review it and you'll be
                  notified when a decision is made.
                </p>
              </div>
            ) : null}

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error.message}
              </p>
            ) : null}
          </form>
        </CardContent>
        <CardFooter className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            disabled={step === STEP_TEAM}
            onClick={prevStep}
            iconBefore={<ArrowLeft className="size-4" />}
          >
            Back
          </Button>
          {step < STEP_REVIEW ? (
            <Button
              type="button"
              onClick={nextStep}
              disabled={
                (step === STEP_TEAM && (!watchedTeamId || homeVenueMissing)) ||
                (step === STEP_ROSTER && selectedPlayers.length < minPlayers) ||
                (step === STEP_ROSTER_CAPTAIN &&
                  needsRosterCaptain &&
                  !watchedRosterCaptain)
              }
              iconAfter={<ArrowRight className="size-4" />}
            >
              Next
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => {
                void onSubmit();
              }}
              loading={isSubmitting || applying}
              disabled={homeVenueMissing || (needsRosterCaptain && !watchedRosterCaptain)}
              iconAfter={<Check className="size-4" />}
              data-testid="apply-confirm"
            >
              Confirm &amp; Send
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

function ReviewRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="text-sm font-medium">{value}</div>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
        Edit
      </Button>
    </div>
  );
}

function teamForSlug(
  teams: Array<{ id: string; slug: string }> | undefined,
  id: string,
): string | undefined {
  return teams?.find((t) => t.id === id)?.slug;
}

/**
 * Round-49 — decides whether the captain can actually file an application
 * right now. Returns a description object when the form should NOT render
 * (and the gating panel should), or null when the form is fine to show.
 *
 * INVITED rows are deliberately allowed through — applyToCompetition's
 * resurrection path will flip them to PENDING on submit.
 */
function computeApplyGate(args: {
  competitionStatus: string | null;
  viewerCanApply: boolean;
  isAdmin: boolean;
  application:
    | { status: string; team: { name: string; slug: string } | null }
    | null;
}): {
  title: string;
  description: string;
  detail: string;
  hint?: string;
} | null {
  const { competitionStatus, viewerCanApply, isAdmin, application } = args;
  if (isAdmin) return null;

  // 1) Already engaged states — block re-entry with a clear status read.
  if (application) {
    // Round-53 — solo INDIVIDUAL apps have no team; this team form never
    // renders for them (page.tsx routes to SoloApplyForm), but keep the
    // fallback so the typecheck stays clean.
    const teamName = application.team?.name ?? "Your application";
    switch (application.status) {
      case "APPROVED":
        return {
          title: "You're already in",
          description: "Your team has been confirmed for this competition.",
          detail: `${teamName} is approved.`,
          hint: "Open the team page to manage your roster.",
        };
      case "PENDING":
        return {
          title: "Application already submitted",
          description: "The organizer is reviewing your application.",
          detail: `${teamName} has a pending application — wait for the organizer's decision.`,
          hint: "We'll notify you here as soon as they respond.",
        };
      case "WAITLISTED":
        return {
          title: "You're on the waitlist",
          description: "The organizer has waitlisted your application.",
          detail: `${teamName} is currently waitlisted.`,
          hint: "If a slot opens, the organizer can still approve you.",
        };
      // INVITED / CANCELLED / REJECTED → fall through; the form's
      // resurrection path will reset and re-submit cleanly.
    }
  }

  // 2) Competition-state gates.
  if (competitionStatus !== "OPEN_FOR_APPLICATIONS") {
    const label = (competitionStatus ?? "draft").toLowerCase().replace(/_/g, " ");
    return {
      title: "Applications aren't open yet",
      description: "You can't submit an application right now.",
      detail: `This competition is currently ${label}.`,
      hint:
        application?.status === "INVITED"
          ? "Your invitation is saved — accept again once the organizer opens applications."
          : "Check back once the organizer opens applications.",
    };
  }

  // 3) Permission gates from the server resolver. If the comp is OPEN but
  // viewerCanApply is false, the viewer isn't on the invite list for an
  // INVITE_ONLY comp (and isn't an admin) — surface that explicitly.
  if (!viewerCanApply) {
    return {
      title: "This competition is invite-only",
      description: "Only invited teams can submit an application.",
      detail: "Your team isn't on the organizer's invite list.",
      hint: "Ask the organizer to send you an invite from the Applications page.",
    };
  }

  return null;
}
