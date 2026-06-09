"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@apollo/client/react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
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
import { VenuesListQuery } from "@/lib/graphql/operations/venue.operations";
import { ApplyToCompetitionMutation } from "@/lib/graphql/operations/competition-mutations.operations";
import {
  CompetitionHeaderQuery,
  ViewerQuery,
} from "@/lib/graphql/operations/competition.operations";
import { RosterConflictsQuery } from "@/lib/graphql/operations/roster.operations";

const schema = z.object({
  teamId: z.string().min(1, "Pick a team"),
  venueId: z.string().optional(),
  playerUserIds: z.array(z.string()),
  message: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type StepIndex = 0 | 1 | 2 | 3;
const STEPS = [
  { title: "Choose team", desc: "Select the team you want to enter." },
  { title: "Roster", desc: "Pick the players who will compete." },
  { title: "Message", desc: "Optional note to the organizer." },
  { title: "Review & Send", desc: "Confirm everything and send to the organizer." },
] as const;

export function ApplyForm({ slug }: { slug: string }) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<StepIndex>(0);
  const compQuery = useQuery(CompetitionHeaderQuery, { variables: { slug } });
  const teamsQuery = useQuery(TeamsListQuery);
  const viewerQuery = useQuery(ViewerQuery, { errorPolicy: "ignore" });
  const venuesQuery = useQuery(VenuesListQuery, { variables: {} });
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
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
    defaultValues: { teamId: "", venueId: "", playerUserIds: [], message: "" },
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
  const venues = venuesQuery.data?.venues ?? [];
  const roster = teamDetailQuery.data?.team?.members ?? [];
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

  // Sync the local team id used to drive the roster fetch
  if (watchedTeamId !== selectedTeamId) {
    setSelectedTeamId(watchedTeamId);
    setValue("playerUserIds", []);
  }

  const togglePlayer = (id: string) => {
    const cur = new Set(selectedPlayers);
    cur.has(id) ? cur.delete(id) : cur.add(id);
    setValue("playerUserIds", Array.from(cur), { shouldValidate: true });
  };

  function nextStep() {
    if (step === 0 && !watchedTeamId) return;
    setStep((s) => (Math.min(s + 1, 3) as StepIndex));
  }
  function prevStep() {
    setStep((s) => (Math.max(s - 1, 0) as StepIndex));
  }

  const onSubmit = handleSubmit(async (values) => {
    // Gate the actual mutation to the Review step — pressing Enter inside
    // an earlier-step input must not skip ahead.
    if (step !== 3) return;
    if (!competition) return;
    try {
      const result = await apply({
        variables: {
          input: {
            competitionId: competition.id,
            teamId: values.teamId,
            message: values.message || null,
            playerUserIds: values.playerUserIds,
          },
        },
      });
      if (result.data?.applyToCompetition) {
        toast.success("Application submitted", "The organizer will review it.");
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

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>
            Apply to {competition?.name ?? "competition"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Step {step + 1} of {STEPS.length} · {STEPS[step].desc}
          </p>
          <ol
            className="mt-3 flex items-center gap-2"
            aria-label="Apply progress"
          >
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex-1">
                <div
                  className={
                    "h-1.5 rounded-full transition-colors " +
                    (i <= step ? "bg-primary" : "bg-secondary")
                  }
                  // Avoid the word "Team" in the aria-label so it doesn't
                  // collide with getByLabel("Team") in the apply tests.
                  aria-label={`Step ${i + 1}${i === step ? " (current)" : ""}`}
                />
              </li>
            ))}
          </ol>
        </CardHeader>
        <CardContent>
          <form id="apply" onSubmit={onSubmit} className="space-y-5">
            {/* Step 1 — Team selector + optional home venue */}
            {step === 0 ? (
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
                <div className="space-y-1.5">
                  <Label htmlFor="venueId">Home venue</Label>
                  <select
                    id="venueId"
                    {...register("venueId")}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">— optional —</option>
                    {venues.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} · {v.city.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Pick where your team typically plays.
                  </p>
                </div>
              </>
            ) : null}

            {/* Step 2 — Roster */}
            {step === 1 ? (
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
                              <span className="font-semibold">{m.user.name}</span>
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

            {/* Step 3 — Message */}
            {step === 2 ? (
              <div className="space-y-1.5">
                <Label htmlFor="message">Message to organizer (optional)</Label>
                <Input id="message" {...register("message")} />
                <p className="text-xs text-muted-foreground">
                  Tell the organizer anything they should know about your team.
                </p>
              </div>
            ) : null}

            {/* Step 4 — Review & Send */}
            {step === 3 ? (
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
                  onEdit={() => setStep(0)}
                />
                <ReviewRow
                  label="Roster"
                  value={
                    selectedPlayers.length === 0
                      ? "Will use the full team roster"
                      : `${selectedPlayers.length} players selected`
                  }
                  onEdit={() => setStep(1)}
                />
                <ReviewRow
                  label="Message"
                  value={watchedMessage ? watchedMessage : "—"}
                  onEdit={() => setStep(2)}
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
            disabled={step === 0}
            onClick={prevStep}
            iconBefore={<ArrowLeft className="size-4" />}
          >
            Back
          </Button>
          {step < 3 ? (
            <Button
              type="button"
              onClick={nextStep}
              disabled={step === 0 && !watchedTeamId}
              iconAfter={<ArrowRight className="size-4" />}
            >
              Next
            </Button>
          ) : (
            <Button
              form="apply"
              type="submit"
              loading={isSubmitting || applying}
              iconAfter={<Check className="size-4" />}
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
