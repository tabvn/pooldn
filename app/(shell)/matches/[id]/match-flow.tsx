"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useSubscription } from "@apollo/client/react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MatchStatusChip } from "@/components/ui/status-chip";
import { PageTitle } from "@/components/layout/page-title";
import { useToast } from "@/components/ui/toast";
import {
  MarkFrameWalkoverMutation,
  MatchDetailQuery,
  RecordFrameMutation,
  SubmitMatchResultMutation,
} from "@/lib/graphql/operations/match.operations";
import {
  SubmitMatchScoreMutation,
  MatchScoreSubmissionsForMatchQuery,
} from "@/lib/graphql/operations/score-submission.operations";
import { MatchUpdatedSubscription } from "@/lib/graphql/operations/subscriptions.operations";
import { ViewerQuery } from "@/lib/graphql/operations/competition.operations";
import { LineupSubmission } from "./lineup-submission";
import { MatchAdminActions } from "./match-admin-actions";

const frameSchema = z.object({
  frameNumber: z.coerce.number().int().min(1),
  homePlayer: z.string().optional(),
  awayPlayer: z.string().optional(),
});

type FrameInput = z.input<typeof frameSchema>;
type FrameOutput = z.output<typeof frameSchema>;

export function MatchFlow({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const { data, loading, refetch } = useQuery(MatchDetailQuery, {
    variables: { id },
  });
  // Live: any score/frame/forfeit change on this match triggers a refetch so
  // the scoreboard + frames table stay in sync without polling.
  useSubscription(MatchUpdatedSubscription, {
    variables: { id },
    onData: () => {
      void refetch();
    },
  });
  const [recordFrame, { loading: recording, error: recordError }] = useMutation(
    RecordFrameMutation,
  );
  const [submitResult, { loading: submitting, error: submitError }] = useMutation(
    SubmitMatchResultMutation,
  );
  const [markWalkover] = useMutation(MarkFrameWalkoverMutation);
  // errorPolicy "ignore" so guests (no viewer / no access to submissions)
  // still get the read-only match view instead of an errored component.
  const viewerQuery = useQuery(ViewerQuery, { errorPolicy: "ignore" });
  const submissionsQuery = useQuery(MatchScoreSubmissionsForMatchQuery, {
    variables: { matchId: id },
    fetchPolicy: "cache-and-network",
    errorPolicy: "ignore",
  });
  const [submitScore, { loading: scoreSubmitting, error: scoreSubmitError }] =
    useMutation(SubmitMatchScoreMutation);
  // Round-32 — board photos collected before submission. Held locally; the
  // mutation persists them into MatchScoreSubmission.boardImageUrls.
  // MUST be declared with all other hooks BEFORE any early return — moving
  // it later breaks the rules-of-hooks contract once `match` resolves and
  // a previously-skipped render path adds a new hook to the order.
  const [draftBoardImages, setDraftBoardImages] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FrameInput, unknown, FrameOutput>({
    resolver: zodResolver(frameSchema),
    defaultValues: { frameNumber: 1 },
  });

  const match = data?.match;
  if (loading && !match) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!match) {
    return <div className="p-8 text-sm text-muted-foreground">Match not found.</div>;
  }
  const raceTo = match.matchday.competition.raceToFrames;
  const homeWins = match.frames.filter((f) => f.homeWon === true).length;
  const awayWins = match.frames.filter((f) => f.homeWon === false).length;
  const undecided = match.frames.filter((f) => f.homeWon == null).length;
  const nextFrame = match.frames.length + 1;
  const completed = match.status === "COMPLETED";
  const matchId = match.id;
  const blocks = match.matchday.competition.blocks ?? [];
  // Flatten the ordered MatchFormatBlocks into a per-frame scaffold so the
  // lineup card renders Singles/Doubles slots with break markers between
  // blocks — matches the Figma Match Flow lineup.
  const scaffold: Array<
    | { kind: "slot"; frameNumber: number; type: string; blockOrder: number }
    | { kind: "break"; afterBlockOrder: number; minutes: number }
  > = [];
  if (blocks.length > 0) {
    let frameCounter = 0;
    const sorted = [...blocks].sort((a, b) => a.order - b.order);
    for (const b of sorted) {
      for (let i = 0; i < b.games; i++) {
        frameCounter += 1;
        scaffold.push({
          kind: "slot",
          frameNumber: frameCounter,
          type: String(b.type),
          blockOrder: b.order,
        });
      }
      if (b.breakAfterMin && b.breakAfterMin > 0) {
        scaffold.push({
          kind: "break",
          afterBlockOrder: b.order,
          minutes: b.breakAfterMin,
        });
      }
    }
  }
  const scaffoldFrameCount = scaffold.filter(
    (s) => s.kind === "slot",
  ).length;

  const onAddGame = handleSubmit(async (values) => {
    try {
      await recordFrame({
        variables: {
          input: {
            matchId,
            frameNumber: values.frameNumber,
            // Undecided by default — captain picks winner after the game.
            homeWon: false,
            homePlayer: values.homePlayer || null,
            awayPlayer: values.awayPlayer || null,
          },
        },
      });
      reset({ frameNumber: values.frameNumber + 1 });
      await refetch();
    } catch (e) {
      toast.error(
        "Could not add game",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  });

  async function pickWinner(
    frameId: string,
    frameNumber: number,
    homePlayer: string | null,
    awayPlayer: string | null,
    homeWon: boolean,
    /** Round-47 — preserve the existing B&R flag on a winner-swap; the
     *  separate B&R toggle below sets it explicitly. */
    breakAndRun: boolean = false,
  ) {
    await recordFrame({
      variables: {
        input: {
          matchId,
          frameNumber,
          homeWon,
          homePlayer,
          awayPlayer,
          breakAndRun,
        },
      },
    });
    void frameId;
    await refetch();
  }

  /** Round-47 — flip the B&R flag on an already-decided frame. */
  async function toggleBreakAndRun(
    frameNumber: number,
    homePlayer: string | null,
    awayPlayer: string | null,
    homeWon: boolean,
    next: boolean,
  ) {
    await recordFrame({
      variables: {
        input: {
          matchId,
          frameNumber,
          homeWon,
          homePlayer,
          awayPlayer,
          breakAndRun: next,
        },
      },
    });
    await refetch();
  }

  async function walkoverFrame(frameNumber: number, homeWon: boolean) {
    await markWalkover({
      variables: { matchId, frameNumber, homeWon },
    });
    await refetch();
  }

  async function onConfirmResult() {
    // Legacy single-captain instant-complete — kept only for organizer/admin
    // direct submit. Captains use submitMatchScore below.
    try {
      await submitResult({
        variables: {
          input: { matchId, homeScore: homeWins, awayScore: awayWins },
        },
      });
      toast.success("Match completed");
      await refetch();
      router.refresh();
    } catch (e) {
      toast.error(
        "Could not confirm result",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  async function onCaptainSubmitScore() {
    try {
      await submitScore({
        variables: {
          input: {
            matchId,
            homeScore: homeWins,
            awayScore: awayWins,
            boardImageUrls: draftBoardImages,
          },
        },
      });
      toast.success("Score submitted");
      setDraftBoardImages([]);
      await Promise.all([refetch(), submissionsQuery.refetch()]);
      router.refresh();
    } catch (e) {
      toast.error(
        "Could not submit score",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  const viewer = viewerQuery.data?.viewer;
  const viewerId = viewer?.id;
  const isHomeCaptain =
    !!viewerId && match.homeTeam?.captain?.id === viewerId;
  const isAwayCaptain =
    !!viewerId && match.awayTeam?.captain?.id === viewerId;
  const isCaptain = isHomeCaptain || isAwayCaptain;
  const isAdmin = viewer?.role === "SUPER_ADMIN" || viewer?.role === "ORGANIZER";
  const submissions = submissionsQuery.data?.matchScoreSubmissionsForMatch ?? [];
  const mySubmission =
    submissions.find((s) => s.submittedBy.id === viewerId) ?? null;
  const otherSubmission =
    submissions.find((s) => s.submittedBy.id !== viewerId) ?? null;
  const hasConflict = submissions.some((s) => s.status === "CONFLICT");
  const autoApproved = submissions.some((s) => s.status === "AUTO_APPROVED");

  const allDecided =
    match.frames.length > 0 &&
    undecided === 0 &&
    !completed &&
    (scaffoldFrameCount === 0 || match.frames.length >= scaffoldFrameCount);
  const hitsRace = homeWins >= raceTo || awayWins >= raceTo;

  return (
    <div className="flex flex-col">
      <PageTitle
        title={`${match.homeTeam?.name ?? "TBD"} vs ${match.awayTeam?.name ?? "TBD"}`}
        eyebrow={
          <Link
            href={`/competitions/${match.matchday.competition.slug}`}
            className="inline-flex items-center gap-2 hover:underline"
          >
            <Avatar
              size="sm"
              src={match.matchday.competition.bannerUrl ?? undefined}
              fallback={match.matchday.competition.name}
              shape="competition"
            />
            <span>
              {match.matchday.competition.name} · Matchday{" "}
              {match.matchday.number}
            </span>
          </Link>
        }
        meta={
          <>
            <MatchStatusChip status={match.status} />
            {match.winType && match.winType !== "NORMAL" ? (
              <Badge variant="warning">
                {match.winType === "DOUBLE_FORFEIT"
                  ? "Double forfeit"
                  : "Walkover"}
              </Badge>
            ) : null}
            {match.venue ? <span>{match.venue.name}</span> : null}
            <Badge variant="primary">Race to {raceTo}</Badge>
          </>
        }
      />

      <div className="p-4 md:p-8 space-y-6">
        {/* Scoreboard — mirrors the Team Match Card in the Figma */}
        <Card>
          <CardContent className="flex items-center justify-center gap-6 py-6 md:gap-12 md:py-8">
            <TeamSide
              name={match.homeTeam?.name}
              slug={match.homeTeam?.slug}
              logoUrl={match.homeTeam?.logoUrl}
              score={match.homeScore ?? homeWins}
              raceTo={raceTo}
              leading={homeWins > awayWins}
            />
            <span className="text-muted-foreground text-3xl">–</span>
            <TeamSide
              name={match.awayTeam?.name}
              slug={match.awayTeam?.slug}
              logoUrl={match.awayTeam?.logoUrl}
              score={match.awayScore ?? awayWins}
              raceTo={raceTo}
              leading={awayWins > homeWins}
            />
          </CardContent>
        </Card>

        {/* Round-31 — audit panel: who/when accepted the final score. */}
        {completed ? (
          <ResultAuditCard
            completedAt={match.completedAt ?? null}
            completionMode={match.completionMode ?? null}
            completedBy={match.completedBy ?? null}
          />
        ) : null}

        {/* Round-31 — submissions trail: both captains' submissions side by
            side with timestamps. Visible whenever any submission exists so
            captains/organizers can verify what the other side actually sent. */}
        {submissions.length > 0 ? (
          <SubmissionsTrail submissions={submissions} />
        ) : null}

        {/* Round-20 — organizer + captain match-controls (forfeit / reschedule). */}
        <MatchAdminActions
          matchId={match.id}
          isOrganizer={
            !!viewer &&
            (viewer.role === "SUPER_ADMIN" ||
              match.matchday.competition.organizer?.id === viewer.id)
          }
          isCaptain={
            !!viewer &&
            (match.homeTeam?.captain?.id === viewer.id ||
              match.awayTeam?.captain?.id === viewer.id)
          }
          homeTeam={match.homeTeam ?? null}
          awayTeam={match.awayTeam ?? null}
          status={match.status}
          scheduledAt={match.scheduledAt ?? null}
          onMutated={async () => {
            await refetch();
          }}
        />

        {/* Round-14 — captain-facing lineup submission with the gating
            "hidden until both captains submit" rule. */}
        <LineupSubmission
          matchId={match.id}
          blocks={(match.matchday.competition.blocks ?? []) as never}
          viewerId={viewer?.id}
          viewerRole={viewer?.role}
          matchStatus={match.status}
          homeTeam={match.homeTeam ?? null}
          awayTeam={match.awayTeam ?? null}
          homeLineupSubmittedAt={match.homeLineupSubmittedAt ?? null}
          awayLineupSubmittedAt={match.awayLineupSubmittedAt ?? null}
          lineupEditRequestedAt={match.lineupEditRequestedAt ?? null}
          lineupEditRequestedById={match.lineupEditRequestedById ?? null}
          lineupEditRequestedSide={match.lineupEditRequestedSide ?? null}
          frames={match.frames}
          onSubmitted={async () => {
            await refetch();
          }}
        />

        {/* Match Lineups — the captain's working surface */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Match Lineups</CardTitle>
              {!completed ? (
                <span className="text-xs text-muted-foreground">
                  Click a player to select the winner of each game.
                </span>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {scaffold.length > 0 ? (
              // Block-driven scaffold — Singles/Doubles slots in order, with
              // break markers between blocks. Drives layout off the
              // competition's MatchFormatBlock list (Round-9 Structure step).
              <ul
                data-testid="match-lineup-scaffold"
                className="grid grid-cols-1 gap-3"
              >
                {scaffold.map((s, idx) => {
                  if (s.kind === "break") {
                    return (
                      <li
                        key={`break-${idx}`}
                        data-testid="match-lineup-break"
                        className="flex items-center gap-3 rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 px-4 py-2 text-xs font-medium text-amber-300"
                      >
                        <span>⏸</span>
                        Break — {s.minutes} min before next block
                      </li>
                    );
                  }
                  const f = match.frames.find(
                    (frame) => frame.frameNumber === s.frameNumber,
                  );
                  return (
                    <LineupSlot
                      key={`slot-${s.frameNumber}`}
                      frameNumber={s.frameNumber}
                      type={s.type}
                      frame={f}
                      completed={completed}
                      homeTeamName={match.homeTeam?.name}
                      awayTeamName={match.awayTeam?.name}
                      breakAndRunRule={
                        !!match.matchday.competition.breakAndRunRule
                      }
                      onPickWinner={(homeWon) =>
                        pickWinner(
                          f?.id ?? "",
                          s.frameNumber,
                          f?.homePlayer ?? null,
                          f?.awayPlayer ?? null,
                          homeWon,
                          f?.breakAndRun ?? false,
                        )
                      }
                      onWalkover={(homeWon) =>
                        walkoverFrame(s.frameNumber, homeWon)
                      }
                      onToggleBreakAndRun={(next) =>
                        toggleBreakAndRun(
                          s.frameNumber,
                          f?.homePlayer ?? null,
                          f?.awayPlayer ?? null,
                          f?.homeWon ?? false,
                          next,
                        )
                      }
                    />
                  );
                })}
              </ul>
            ) : match.frames.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No games recorded yet. Add the first game below.
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-3">
                {match.frames.map((f) => (
                  <li key={f.id}>
                    <div className="rounded-xl border border-border bg-background overflow-hidden">
                      <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-4 py-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Game {f.frameNumber}
                        </span>
                        {f.homeWon == null ? (
                          <Badge variant="warning" size="sm">
                            undecided
                          </Badge>
                        ) : (
                          <Badge variant="success" size="sm">
                            {f.homeWon
                              ? match.homeTeam?.name ?? "Home"
                              : match.awayTeam?.name ?? "Away"}{" "}
                            won
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-border">
                        <PlayerSlot
                          name={f.homePlayer}
                          isWinner={f.homeWon === true}
                          disabled={completed}
                          onClick={() =>
                            pickWinner(
                              f.id,
                              f.frameNumber,
                              f.homePlayer ?? null,
                              f.awayPlayer ?? null,
                              true,
                            )
                          }
                        />
                        <PlayerSlot
                          name={f.awayPlayer}
                          isWinner={f.homeWon === false && f.homeWon !== null}
                          disabled={completed}
                          onClick={() =>
                            pickWinner(
                              f.id,
                              f.frameNumber,
                              f.homePlayer ?? null,
                              f.awayPlayer ?? null,
                              false,
                            )
                          }
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {!completed && scaffold.length === 0 ? (
              <form
                onSubmit={onAddGame}
                className="grid grid-cols-1 gap-3 md:grid-cols-4 pt-3 border-t border-border"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="frameNumber">Game #</Label>
                  <Input
                    id="frameNumber"
                    type="number"
                    min={1}
                    invalid={!!errors.frameNumber}
                    defaultValue={nextFrame}
                    {...register("frameNumber")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="homePlayer">Home player</Label>
                  <Input
                    id="homePlayer"
                    placeholder="e.g. Thomas B. 🇨🇦"
                    {...register("homePlayer")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="awayPlayer">Away player</Label>
                  <Input
                    id="awayPlayer"
                    placeholder="e.g. Linh T. 🇻🇳"
                    {...register("awayPlayer")}
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit" block loading={recording}>
                    Add game
                  </Button>
                </div>
                {recordError ? (
                  <p className="md:col-span-4 text-sm text-destructive">
                    {recordError.message}
                  </p>
                ) : null}
              </form>
            ) : null}
          </CardContent>
        </Card>

        {!completed ? (
          <div className="rounded-md border border-border bg-card p-4">
            {/* Score-submission banner — visible to BOTH captains. */}
            {(isCaptain || isAdmin) ? (
              <ScoreSubmissionBanner
                isCaptain={isCaptain}
                isAdmin={!!isAdmin}
                mySubmission={mySubmission}
                otherSubmission={otherSubmission}
                hasConflict={hasConflict}
                allDecided={allDecided}
                homeWins={homeWins}
                awayWins={awayWins}
                onSubmit={onCaptainSubmitScore}
                onAdminConfirm={onConfirmResult}
                submitting={scoreSubmitting}
                adminSubmitting={submitting}
                scoreSubmitError={scoreSubmitError?.message ?? null}
                submitError={submitError?.message ?? null}
                viewerId={viewerId ?? null}
                draftBoardImages={draftBoardImages}
                setDraftBoardImages={setDraftBoardImages}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {match.frames.length === 0
                  ? "Captains will pick a winner for each game and confirm the score."
                  : undecided > 0
                    ? `${undecided} game${undecided === 1 ? "" : "s"} still need a winner.`
                    : "Waiting for captains to confirm the result."}
              </p>
            )}
          </div>
        ) : autoApproved ? (
          <div className="rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
            Both captains agreed — match auto-approved.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TeamSide({
  name,
  slug,
  logoUrl,
  score,
  raceTo,
  leading,
}: {
  name: string | null | undefined;
  slug?: string | null;
  logoUrl?: string | null;
  score: number;
  raceTo: number;
  leading: boolean;
}) {
  const inner = (
    <>
      <Avatar
        size="xl"
        src={logoUrl ?? undefined}
        fallback={name ?? "—"}
        shape="team"
      />
      <span className="text-sm font-semibold">{name ?? "TBD"}</span>
    </>
  );
  return (
    <div className="flex flex-col items-center gap-2">
      {slug ? (
        // eslint-disable-next-line @next/next/no-html-link-for-pages
        <a
          href={`/teams/${slug}`}
          className="flex flex-col items-center gap-2 hover:opacity-90"
        >
          {inner}
        </a>
      ) : (
        inner
      )}
      <div className="flex items-baseline gap-2">
        <span
          className={
            "text-5xl font-black tabular-nums " +
            (leading ? "text-primary" : "text-foreground")
          }
        >
          {score}
        </span>
        <span className="text-xs text-muted-foreground">/ {raceTo}</span>
      </div>
    </div>
  );
}

/**
 * Round-31 — "How this result was confirmed" panel for completed matches.
 *
 * AUTO_AGREED       → "Auto-confirmed by both captains at <time>" — no human
 *                      reviewer; both captains' matching submissions sealed it.
 * ORGANIZER_REVIEW  → organizer (avatar + name + when) finalized after review
 *                      (typically a CONFLICT) or a direct manual entry.
 * ADMIN_OVERRIDE    → SUPER_ADMIN finalized; renders the admin name with an
 *                      "Admin override" pill.
 * FORFEIT           → walkover / no-show; renders who recorded the forfeit.
 */
function ResultAuditCard({
  completedAt,
  completionMode,
  completedBy,
}: {
  completedAt: string | null;
  completionMode:
    | "AUTO_AGREED"
    | "ORGANIZER_REVIEW"
    | "ADMIN_OVERRIDE"
    | "FORFEIT"
    | null;
  completedBy:
    | {
        id: string;
        name: string;
        username: string;
        avatarUrl?: string | null;
      }
    | null;
}) {
  if (!completionMode && !completedAt) return null;
  const when = completedAt
    ? new Date(completedAt).toLocaleString()
    : "—";
  let title = "Result confirmed";
  let subtitle: string | null = null;
  let badge: { label: string; variant: "primary" | "warning" | "success" | "neutral" } | null = null;
  switch (completionMode) {
    case "AUTO_AGREED":
      title = "Auto-confirmed by both captains";
      subtitle = `Both captains submitted matching scores at ${when}.`;
      badge = { label: "Auto", variant: "success" };
      break;
    case "ORGANIZER_REVIEW":
      title = "Finalized by organizer";
      subtitle = completedBy
        ? `${completedBy.name} (@${completedBy.username}) reviewed and accepted on ${when}.`
        : `Reviewed on ${when}.`;
      badge = { label: "Organizer reviewed", variant: "primary" };
      break;
    case "ADMIN_OVERRIDE":
      title = "Admin override";
      subtitle = completedBy
        ? `Admin ${completedBy.name} finalized on ${when}.`
        : `Admin finalized on ${when}.`;
      badge = { label: "Admin", variant: "warning" };
      break;
    case "FORFEIT":
      title = "Recorded as forfeit";
      subtitle = completedBy
        ? `${completedBy.name} recorded the forfeit on ${when}.`
        : `Forfeit recorded on ${when}.`;
      badge = { label: "Forfeit", variant: "warning" };
      break;
    default:
      subtitle = `Completed on ${when}.`;
  }
  return (
    <Card data-testid="result-audit">
      <CardContent className="flex items-start gap-3 py-3">
        {completedBy ? (
          <Link
            href={`/players/${completedBy.username}`}
            className="hover:underline"
          >
            <Avatar
              size="sm"
              src={completedBy.avatarUrl ?? undefined}
              fallback={completedBy.name}
            />
          </Link>
        ) : (
          <div className="flex size-8 items-center justify-center rounded-full bg-success/20 text-success">
            ✓
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{title}</span>
            {badge ? (
              <Badge variant={badge.variant} size="sm">
                {badge.label}
              </Badge>
            ) : null}
          </div>
          {subtitle ? (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Round-31 — compact trail of who submitted what and when, plus the review
 * outcome. Surfaces in both the conflict and post-completion states so the
 * audit is always there.
 */
function SubmissionsTrail({
  submissions,
}: {
  submissions: Array<{
    id: string;
    homeScore: number;
    awayScore: number;
    status: string;
    note?: string | null;
    boardImageUrls?: string[];
    createdAt: string;
    reviewedAt?: string | null;
    submittedBy: { id: string; name: string; username: string };
    reviewedBy?: { id: string; name: string } | null;
    forTeam: { id: string; name: string };
  }>;
}) {
  const STATUS_BADGE: Record<
    string,
    "primary" | "warning" | "success" | "neutral"
  > = {
    PENDING: "neutral",
    AUTO_APPROVED: "success",
    APPROVED: "success",
    CONFLICT: "warning",
    REJECTED: "neutral",
  };
  const inConflict = submissions.some((s) => s.status === "CONFLICT");
  return (
    <Card data-testid="submissions-trail">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Score submissions</CardTitle>
          {inConflict && submissions.length >= 2 ? (
            <Badge variant="warning" size="sm">
              Compare side-by-side
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {submissions.map((s) => (
          <div
            key={s.id}
            className="flex flex-col gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm md:flex-row md:items-start md:justify-between"
            data-testid={`submission-${s.id}`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/players/${s.submittedBy.username}`}
                  className="font-semibold hover:underline"
                >
                  {s.submittedBy.name}
                </Link>
                <span className="text-xs text-muted-foreground">
                  for {s.forTeam.name}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Submitted {new Date(s.createdAt).toLocaleString()}
                {s.reviewedAt && s.reviewedBy ? (
                  <>
                    {" · reviewed by "}
                    <span className="font-medium">{s.reviewedBy.name}</span>
                    {" · "}
                    {new Date(s.reviewedAt).toLocaleString()}
                  </>
                ) : s.reviewedAt ? (
                  <> · auto-resolved {new Date(s.reviewedAt).toLocaleString()}</>
                ) : null}
              </div>
              {s.note ? (
                <p className="mt-0.5 text-xs italic text-muted-foreground">
                  "{s.note}"
                </p>
              ) : null}
              {(s.boardImageUrls ?? []).length > 0 ? (
                <div
                  className="mt-2 flex flex-wrap gap-1.5"
                  data-testid={`submission-photos-${s.id}`}
                >
                  {s.boardImageUrls!.map((u, i) => (
                    <a
                      key={u}
                      href={u}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block size-16 overflow-hidden rounded border border-border hover:border-primary/60"
                      data-testid={`submission-photo-${s.id}-${i}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={u}
                        alt="Score board"
                        className="size-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-[11px] text-muted-foreground/70">
                  No board photo attached.
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="font-mono text-base font-bold tabular-nums">
                {s.homeScore} – {s.awayScore}
              </span>
              <Badge variant={STATUS_BADGE[s.status] ?? "neutral"} size="sm">
                {s.status.replace(/_/g, " ")}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ScoreSubmissionBanner({
  isCaptain,
  isAdmin,
  mySubmission,
  otherSubmission,
  hasConflict,
  allDecided,
  homeWins,
  awayWins,
  onSubmit,
  onAdminConfirm,
  submitting,
  adminSubmitting,
  scoreSubmitError,
  submitError,
  viewerId,
  draftBoardImages,
  setDraftBoardImages,
}: {
  isCaptain: boolean;
  isAdmin: boolean;
  mySubmission: { status: string; homeScore: number; awayScore: number } | null;
  otherSubmission: {
    status: string;
    homeScore: number;
    awayScore: number;
    submittedBy: { name: string };
  } | null;
  hasConflict: boolean;
  allDecided: boolean;
  homeWins: number;
  awayWins: number;
  onSubmit: () => void;
  onAdminConfirm: () => void;
  submitting: boolean;
  adminSubmitting: boolean;
  scoreSubmitError: string | null;
  submitError: string | null;
  viewerId: string | null;
  draftBoardImages: string[];
  setDraftBoardImages: (next: string[]) => void;
}) {
  const myInConflict = mySubmission?.status === "CONFLICT";
  // A captain who has already submitted but is now in CONFLICT can re-submit
  // — the resolver upserts so it overwrites their prior row, kicks the other
  // captain's submission back through the agreement check, and clears the
  // conflict if they now agree.
  const canResubmit = isCaptain && myInConflict;

  let message = "Pick a winner for each game, then submit your score.";
  let tone: "muted" | "warning" | "success" | "info" = "muted";
  if (hasConflict) {
    message = `Conflicting scores — yours: ${mySubmission?.homeScore}–${mySubmission?.awayScore} vs ${otherSubmission?.submittedBy.name}: ${otherSubmission?.homeScore}–${otherSubmission?.awayScore}. ${
      canResubmit
        ? "Update your frames above and re-submit to retry agreement, or wait for the organizer to resolve."
        : "Organizer review pending."
    }`;
    tone = "warning";
  } else if (
    mySubmission &&
    otherSubmission &&
    mySubmission.status === "AUTO_APPROVED"
  ) {
    message = "Both captains agreed — auto-approved.";
    tone = "success";
  } else if (mySubmission && !otherSubmission) {
    message = `You submitted ${mySubmission.homeScore}–${mySubmission.awayScore}. Waiting on the other captain.`;
    tone = "info";
  } else if (!mySubmission && otherSubmission) {
    message = `${otherSubmission.submittedBy.name} submitted ${otherSubmission.homeScore}–${otherSubmission.awayScore}. Confirm or submit your own score.`;
    tone = "info";
  }
  const toneClass =
    tone === "warning"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
      : tone === "success"
        ? "border-success/40 bg-success/10 text-success"
        : tone === "info"
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border";
  // Show the uploader on a fresh submission OR a re-submission after conflict
  // — the uploader is the affordance that asks for fresh board photos, which
  // matter most when there's a disagreement.
  const showUploader = isCaptain && viewerId && (!mySubmission || canResubmit);
  return (
    <div className="space-y-3">
      <div
        className={`rounded-md border px-3 py-2 text-sm ${toneClass}`}
        data-testid="score-submission-banner"
      >
        {message}
      </div>
      {showUploader ? (
        <BoardPhotosUploader
          viewerId={viewerId}
          urls={draftBoardImages}
          onChange={setDraftBoardImages}
        />
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {scoreSubmitError ? (
          <p className="text-sm text-destructive">{scoreSubmitError}</p>
        ) : null}
        {submitError ? (
          <p className="text-sm text-destructive">{submitError}</p>
        ) : null}
        {isCaptain ? (
          <Button
            variant={canResubmit ? "primary" : "success"}
            loading={submitting}
            disabled={!allDecided}
            onClick={onSubmit}
            data-testid={canResubmit ? "score-resubmit" : "score-submit"}
          >
            {canResubmit
              ? `Re-submit my score (${homeWins} – ${awayWins})`
              : `Submit my score (${homeWins} – ${awayWins})`}
          </Button>
        ) : null}
        {isAdmin && !isCaptain ? (
          <Button
            variant="primary"
            loading={adminSubmitting}
            disabled={!allDecided}
            onClick={onAdminConfirm}
          >
            Organizer confirm ({homeWins} – {awayWins})
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Round-32 — captain-side board photos uploader. Drops files directly to
 * /api/upload with kind=score-board and accumulates the returned URLs into
 * `urls`; submit time passes them as `boardImageUrls` on the mutation.
 *
 * Up to 3 photos per submission. A captain re-submitting after a CONFLICT
 * starts with a fresh strip — re-attaching photos forces fresh evidence.
 */
function BoardPhotosUploader({
  viewerId,
  urls,
  onChange,
}: {
  viewerId: string;
  urls: string[];
  onChange: (next: string[]) => void;
}) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const MAX = 3;

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = MAX - urls.length;
    if (room <= 0) {
      toast.error(`At most ${MAX} photos per submission`);
      return;
    }
    const queue = Array.from(files).slice(0, room);
    setUploading(true);
    try {
      const next = [...urls];
      for (const f of queue) {
        const fd = new FormData();
        fd.set("kind", "score-board");
        fd.set("ownerId", viewerId);
        fd.set("file", f);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? "Upload failed");
        }
        const json = (await res.json()) as { url: string };
        next.push(json.url);
      }
      onChange(next);
    } catch (e) {
      toast.error("Upload failed", e);
    } finally {
      setUploading(false);
    }
  }

  function remove(idx: number) {
    onChange(urls.filter((_, i) => i !== idx));
  }

  return (
    <div className="rounded-md border border-dashed border-border bg-background/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Board photo evidence
          </p>
          <p className="text-xs text-muted-foreground">
            Snap the scoresheet / board so the result is auditable later.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs hover:border-primary/40">
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            capture="environment"
            multiple
            className="hidden"
            disabled={uploading || urls.length >= MAX}
            onChange={(e) => {
              void upload(e.target.files);
              e.currentTarget.value = "";
            }}
            data-testid="score-board-input"
          />
          {uploading ? "Uploading…" : `Add photo (${urls.length}/${MAX})`}
        </label>
      </div>
      {urls.length > 0 ? (
        <div className="grid grid-cols-3 gap-1.5">
          {urls.map((u, i) => (
            <div
              key={u}
              className="relative aspect-square overflow-hidden rounded border border-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="size-full object-cover" />
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-black/80"
                aria-label="Remove photo"
                data-testid={`score-board-remove-${i}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LineupSlot({
  frameNumber,
  type,
  frame,
  completed,
  homeTeamName,
  awayTeamName,
  breakAndRunRule,
  onPickWinner,
  onWalkover,
  onToggleBreakAndRun,
}: {
  frameNumber: number;
  type: string;
  frame:
    | {
        id: string;
        frameNumber: number;
        homeWon: boolean | null;
        isWalkover?: boolean | null;
        breakAndRun?: boolean | null;
        homePlayer: string | null;
        awayPlayer: string | null;
      }
    | undefined;
  completed: boolean;
  homeTeamName: string | null | undefined;
  awayTeamName: string | null | undefined;
  breakAndRunRule: boolean;
  onPickWinner: (homeWon: boolean) => void;
  onWalkover?: (homeWon: boolean) => void;
  onToggleBreakAndRun?: (next: boolean) => void;
}) {
  const decided = frame && frame.homeWon !== null;
  const isWalkover = !!frame?.isWalkover;
  const isBreakAndRun = !!frame?.breakAndRun;
  return (
    <li data-testid={`lineup-slot-${frameNumber}`}>
      <div className="rounded-xl border border-border bg-background overflow-hidden">
        <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Game {frameNumber}
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="neutral" size="sm">
              {type.replace("_", " ")}
            </Badge>
            {isWalkover ? (
              <Badge variant="warning" size="sm">
                Walkover
              </Badge>
            ) : null}
            {/* Round-47 — Break & Run toggle. Visible only when the comp's
                rule is on AND the frame has a winner (B&R is a property of
                the winning shot). Captains click to flip; the back-end
                re-records the frame with the new value. */}
            {breakAndRunRule && decided && !isWalkover && !completed ? (
              <button
                type="button"
                onClick={() => onToggleBreakAndRun?.(!isBreakAndRun)}
                data-testid={`br-toggle-${frameNumber}`}
                aria-pressed={isBreakAndRun}
                className={
                  "rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider transition-colors " +
                  (isBreakAndRun
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground")
                }
                title={
                  isBreakAndRun
                    ? "Break & Run — winner cleared the rack on the break"
                    : "Mark as Break & Run"
                }
              >
                B&amp;R
              </button>
            ) : breakAndRunRule && decided && isBreakAndRun ? (
              <Badge variant="primary" size="sm">
                B&amp;R
              </Badge>
            ) : null}
            {!frame ? (
              <Badge variant="neutral" size="sm">
                pending
              </Badge>
            ) : !decided ? (
              <Badge variant="warning" size="sm">
                undecided
              </Badge>
            ) : (
              <Badge variant="success" size="sm">
                {frame.homeWon
                  ? homeTeamName ?? "Home"
                  : awayTeamName ?? "Away"}{" "}
                won
              </Badge>
            )}
            {!completed && onWalkover && !isWalkover ? (
              <button
                type="button"
                data-testid={`walkover-${frameNumber}`}
                onClick={() => {
                  // Prompt the captain for which side present (i.e., which
                  // side WINS by walkover). Confirm to avoid accidental
                  // taps from the lineup edit area.
                  const homePresent = window.confirm(
                    `Mark walkover for Game ${frameNumber}?\n\nOK = ${homeTeamName ?? "Home"} present (wins).\nCancel = ${awayTeamName ?? "Away"} present (wins).`,
                  );
                  // window.confirm returns false on Cancel and true on OK.
                  // Either way we award the present side.
                  onWalkover(homePresent);
                }}
                className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300 hover:bg-amber-500/20"
              >
                Walkover
              </button>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-border">
          <PlayerSlot
            name={frame?.homePlayer ?? null}
            isWinner={frame?.homeWon === true}
            disabled={completed}
            onClick={() => onPickWinner(true)}
          />
          <PlayerSlot
            name={frame?.awayPlayer ?? null}
            isWinner={frame?.homeWon === false && frame?.homeWon !== null}
            disabled={completed}
            onClick={() => onPickWinner(false)}
          />
        </div>
      </div>
    </li>
  );
}

function PlayerSlot({
  name,
  isWinner,
  disabled,
  onClick,
}: {
  name: string | null | undefined;
  isWinner: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={
        "flex items-center gap-3 px-4 py-3 text-left transition-colors disabled:cursor-not-allowed " +
        (isWinner
          ? "bg-primary/15 text-primary"
          : "hover:bg-secondary/40 text-foreground")
      }
    >
      <Avatar size="sm" fallback={name ?? "—"} />
      <span className="font-semibold">{name ?? "—"}</span>
      {isWinner ? (
        <Badge className="ml-auto" variant="success" size="sm">
          Winner
        </Badge>
      ) : null}
    </button>
  );
}
