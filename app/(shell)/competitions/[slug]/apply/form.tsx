"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@apollo/client/react";
import { AlertCircle, ArrowLeft } from "lucide-react";
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
import { VenuesListQuery } from "@/lib/graphql/operations/venue.operations";
import { RosterConflictsQuery } from "@/lib/graphql/operations/roster.operations";

const schema = z.object({
  teamId: z.string().min(1, "Pick a team"),
  homeVenueId: z.string().optional(),
  playerUserIds: z.array(z.string()),
  rosterCaptainUserId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export function ApplyForm({
  slug,
  initialTeamId,
}: {
  slug: string;
  initialTeamId?: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const compQuery = useQuery(CompetitionHeaderQuery, { variables: { slug } });
  const teamsQuery = useQuery(TeamsListQuery);
  const viewerQuery = useQuery(ViewerQuery, { errorPolicy: "ignore" });
  const [selectedTeamId, setSelectedTeamId] = useState<string>(
    initialTeamId ?? "",
  );
  const teamDetailQuery = useQuery(TeamDetailQuery, {
    variables: {
      slug: teamForSlug(teamsQuery.data?.teams, selectedTeamId) ?? "",
    },
    skip: !selectedTeamId,
  });
  const [apply, { error, loading: applying }] = useMutation(
    ApplyToCompetitionMutation,
  );
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      teamId: "",
      homeVenueId: "",
      playerUserIds: [],
      rosterCaptainUserId: "",
    },
  });

  const competition = compQuery.data?.competition;
  // Round-43 — restrict the dropdown to teams the viewer actually captains.
  const viewerId = viewerQuery.data?.viewer?.id;
  const isAdmin = viewerQuery.data?.viewer?.role === "SUPER_ADMIN";
  const allTeams = teamsQuery.data?.teams ?? [];
  const teams = isAdmin
    ? allTeams
    : allTeams.filter((t) => t.captain?.id === viewerId);
  const team = teamDetailQuery.data?.team;
  const roster = team?.members ?? [];

  // Round-61 — Home venue is required for Home & Away competitions on team
  // venues (every team hosts, so each needs a venue), or whenever the
  // organizer explicitly set requiresHomeVenue. Only then do we show the
  // inline venue selector.
  const needsHomeVenue =
    Boolean(competition?.requiresHomeVenue) ||
    ((competition?.gamesPerOpponent ?? 1) >= 2 &&
      competition?.matchVenueMode !== "CENTRAL_VENUE");

  const venuesQuery = useQuery(VenuesListQuery, {
    variables: { cityId: competition?.city?.id ?? null },
    skip: !needsHomeVenue,
  });
  const venues = venuesQuery.data?.venues ?? [];

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
  const watchedHomeVenue = watch("homeVenueId") ?? "";
  const selectedPlayers = watch("playerUserIds") ?? [];
  const watchedRosterCaptain = watch("rosterCaptainUserId") ?? "";

  // Sync the local team id used to drive the roster fetch; reset the
  // dependent selections when the captain switches teams.
  if (watchedTeamId !== selectedTeamId) {
    setSelectedTeamId(watchedTeamId);
    setValue("playerUserIds", []);
    setValue("rosterCaptainUserId", "");
    setValue("homeVenueId", "");
  }

  // Pre-select the team's existing home venue once its detail loads.
  useEffect(() => {
    if (team?.homeVenue?.id && !watchedHomeVenue) {
      setValue("homeVenueId", team.homeVenue.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team?.homeVenue?.id]);

  // Round-49 — pre-select the team when the captain landed here via an
  // invite accept link (?teamId=…).
  useEffect(() => {
    if (!initialTeamId || watchedTeamId) return;
    if (!teamsQuery.data) return;
    const inViewerTeams = teams.some((t) => t.id === initialTeamId);
    if (inViewerTeams || isAdmin) {
      setValue("teamId", initialTeamId, { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTeamId, teamsQuery.data, isAdmin]);

  const togglePlayer = (id: string) => {
    const cur = new Set(selectedPlayers);
    cur.has(id) ? cur.delete(id) : cur.add(id);
    const next = Array.from(cur);
    setValue("playerUserIds", next, { shouldValidate: true });
    // Clear the Roster Leader if they just got unchecked.
    if (watchedRosterCaptain && !cur.has(watchedRosterCaptain)) {
      setValue("rosterCaptainUserId", "");
    }
  };

  // Round-48 / Round-61 — Roster Leader is required when the team captain
  // isn't one of the playing players.
  const teamCaptainId = team?.captain?.id ?? null;
  const captainIsPlaying = Boolean(
    teamCaptainId && selectedPlayers.includes(teamCaptainId),
  );
  const needsRosterCaptain = Boolean(
    teamCaptainId && selectedPlayers.length > 0 && !captainIsPlaying,
  );

  const homeVenueMissing = needsHomeVenue && !watchedHomeVenue;

  const rosterPlayers = useMemo(
    () =>
      roster
        .filter((m) => selectedPlayers.includes(m.user.id))
        .map((m) => m.user),
    [roster, selectedPlayers],
  );

  const submitDisabled =
    !watchedTeamId ||
    selectedPlayers.length < minPlayers ||
    selectedPlayers.length > maxPlayers ||
    homeVenueMissing ||
    (needsRosterCaptain && !watchedRosterCaptain);

  async function onSubmit() {
    if (!competition) return;
    if (submitDisabled) return;
    try {
      const result = await apply({
        variables: {
          input: {
            competitionId: competition.id,
            teamId: watchedTeamId,
            homeVenueId: watchedHomeVenue || null,
            playerUserIds: selectedPlayers,
            rosterCaptainUserId: watchedRosterCaptain || null,
          },
        },
      });
      if (result.data?.applyToCompetition) {
        if (result.data.applyToCompetition.status === "APPROVED") {
          toast.success("You're in", "Your team is on the competition list.");
        } else {
          toast.success("Application submitted", "The organizer will review it.");
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
  }

  // Round-49 — Apply-gate panel: blocks the form when the captain can't file
  // an application right now (comp not open, already approved/pending, etc).
  const gate = computeApplyGate({
    competitionStatus: competition?.status ?? null,
    viewerCanApply: competition?.viewerCanApply ?? false,
    isAdmin,
    application: competition?.myTeamApplication ?? null,
  });
  if (competition && gate) {
    return (
      <div className="mx-auto max-w-2xl">
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
    <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card">
      {/* Title */}
      <div className="border-b border-border px-6 py-5 text-center">
        <h1 className="text-base font-semibold text-foreground">
          Apply to Competition
        </h1>
        {competition?.name ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {competition.name}
          </p>
        ) : null}
      </div>

      <form
        id="apply"
        onSubmit={(e) => e.preventDefault()}
        className="mx-auto w-full max-w-[480px] space-y-5 px-6 py-6"
      >
        {/* Team */}
        <div className="space-y-1.5">
          <Label htmlFor="teamId">Team</Label>
          <select
            id="teamId"
            {...register("teamId")}
            className={SELECT_CLASS}
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
            <p className="text-xs text-destructive">{errors.teamId.message}</p>
          ) : null}
        </div>

        {/* Home Venue — Home & Away comps only */}
        {needsHomeVenue ? (
          <div className="space-y-1.5">
            <div>
              <Label htmlFor="homeVenueId">Home Venue</Label>
              <p className="text-xs text-muted-foreground">
                This competition requires each team to have a home venue.
              </p>
            </div>
            <select
              id="homeVenueId"
              value={watchedHomeVenue}
              onChange={(e) =>
                setValue("homeVenueId", e.target.value, {
                  shouldValidate: true,
                })
              }
              className={SELECT_CLASS}
              disabled={!selectedTeamId || venues.length === 0}
            >
              <option value="">
                {venues.length === 0
                  ? "No venues available in this city"
                  : "Select a home venue…"}
              </option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.city?.name ? ` · ${v.city.name}` : ""}
                </option>
              ))}
            </select>
            {homeVenueMissing && selectedTeamId ? (
              <p className="text-xs text-destructive">
                Pick a home venue to continue.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Select Roster — current selection UI, kept as-is */}
        <div className="space-y-2">
          <div>
            <Label>Select Roster</Label>
            <p className="text-xs text-muted-foreground">
              Select {minPlayers} to {maxPlayers} players who will compete in
              this competition.
            </p>
          </div>
          <div className="rounded-lg border border-[#00598a] bg-[#052f4a] p-3 text-sm leading-5 text-[#dff2fe]">
            Your Roster is the group of players you&rsquo;re entering into this
            competition. While players can be members of multiple teams, each
            player can only compete for one team.
          </div>
          {!selectedTeamId ? (
            <p className="rounded-md border border-dashed border-border bg-secondary/30 px-3 py-4 text-xs text-muted-foreground">
              Pick a team to see its roster.
            </p>
          ) : roster.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-secondary/30 px-3 py-4 text-xs text-muted-foreground">
              This team has no members yet.
            </p>
          ) : (
            <ul className="grid max-h-[320px] grid-cols-1 gap-2 overflow-y-auto md:grid-cols-2">
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
                        onChange={() => !disabled && togglePlayer(m.user.id)}
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
                            <Badge variant="primary" size="sm" className="ml-2">
                              Captain
                            </Badge>
                          ) : null}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          @{m.user.username}
                          {m.user.nationality ? ` · ${m.user.nationality}` : ""}
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
          {selectedTeamId && roster.length > 0 ? (
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
          ) : null}
        </div>

        {/* Roster Leader — only when the captain isn't playing */}
        {needsRosterCaptain ? (
          <div className="space-y-2" data-testid="roster-captain-step">
            <div>
              <Label>Roster Leader</Label>
              <p className="text-xs text-muted-foreground">
                You&rsquo;re not in the roster — pick a player to captain this
                competition (manage lineups and confirm results).
              </p>
            </div>
            <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {rosterPlayers.map((u) => {
                const checked = watchedRosterCaptain === u.id;
                return (
                  <li key={u.id}>
                    <label
                      className={
                        "flex cursor-pointer items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm transition-colors " +
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

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error.message}
          </p>
        ) : null}
      </form>

      {/* Submit */}
      <div className="border-t border-border px-6 py-4">
        <div className="mx-auto w-full max-w-[480px]">
          <Button
            type="button"
            variant="primary"
            className="w-full"
            loading={applying}
            disabled={submitDisabled}
            onClick={() => void onSubmit()}
            data-testid="apply-confirm"
          >
            Submit Application
          </Button>
        </div>
      </div>
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

  // 3) Permission gates from the server resolver.
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
