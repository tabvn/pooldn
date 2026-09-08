"use client";

import { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CountryFlag } from "@/components/ui/country-flag";
import { useToast } from "@/components/ui/toast";
import { RecordFrameMutation } from "@/lib/graphql/operations/match.operations";
import { errorText } from "@/lib/apollo/error-message";

type Player = {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string | null;
  nationality?: string | null;
  /** Round-88 — an unclaimed placeholder profile; drawn with the ghost mark. */
  isShell?: boolean;
} | null;

export type SinglesMatchData = {
  id: string;
  status: string;
  homeScore?: number | null;
  awayScore?: number | null;
  homePlayer: Player;
  awayPlayer: Player;
  frames: Array<{ frameNumber: number; homeWon?: boolean | null; breakAndRun: boolean }>;
  matchday: { competition: { raceToFrames: number; breakAndRunRule: boolean } };
};

export type SinglesSubmission = {
  id: string;
  homeScore: number;
  awayScore: number;
  status: string;
  submittedBy: { id: string; name: string };
} | null;

/**
 * Round-68 — 1v1 Singles match. No lineups: the two players record frame
 * winners (race-to-N) into one shared log.
 *
 * Round-79 — finalizing is a two-sided decision. Reaching the race-to target
 * no longer completes the match on its own (one player could otherwise close
 * it at whatever score they'd entered). Both players confirm the final score:
 * agreement completes it, disagreement raises a CONFLICT the organizer
 * settles. The organizer/admin can always finalize directly.
 */
export function SinglesMatch({
  match,
  viewerId,
  viewerRole,
  organizerId,
  mySubmission,
  otherSubmission,
  allSubmissions = [],
  hasConflict = false,
  onSubmitScore,
  onOrganizerConfirm,
  onChanged,
}: {
  match: SinglesMatchData;
  viewerId: string | null;
  viewerRole: string | null;
  organizerId: string | null;
  mySubmission?: SinglesSubmission;
  otherSubmission?: SinglesSubmission;
  /** Round-81 — every submission on the match. Staff aren't a side, so
   *  my/other can't represent the two players for them. */
  allSubmissions?: NonNullable<SinglesSubmission>[];
  hasConflict?: boolean;
  onSubmitScore?: (homeScore: number, awayScore: number) => Promise<unknown>;
  onOrganizerConfirm?: (
    homeScore: number,
    awayScore: number,
  ) => Promise<unknown>;
  onChanged: () => Promise<unknown> | void;
}) {
  const toast = useToast();
  const [recordFrame, { loading }] = useMutation(RecordFrameMutation);
  const [br, setBr] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [disputeHome, setDisputeHome] = useState("");
  const [disputeAway, setDisputeAway] = useState("");
  // Staff's own final score, when neither player's number is right.
  const [staffHome, setStaffHome] = useState("");
  const [staffAway, setStaffAway] = useState("");

  const completed = match.status === "COMPLETED";
  const raceTo = match.matchday.competition.raceToFrames;
  const brRule = match.matchday.competition.breakAndRunRule;
  const decided = match.frames.filter((f) => f.homeWon != null);
  const homeWins = decided.filter((f) => f.homeWon === true).length;
  const awayWins = decided.filter((f) => f.homeWon === false).length;

  const isPlayer =
    !!viewerId &&
    (match.homePlayer?.id === viewerId || match.awayPlayer?.id === viewerId);
  const isStaff =
    viewerRole === "SUPER_ADMIN" || (!!viewerId && organizerId === viewerId);
  // Round-79 — the race is "over" once someone reaches the target, but the
  // match only ends when both players confirm (or staff settles it).
  const raceReached = homeWins >= raceTo || awayWins >= raceTo;
  // Round-80 — the frame log is shared, so it stops accepting entries once
  // the race is decided OR either side has submitted a final score. Without
  // this the second player kept tapping past the target (4–1, 5–1 on a race
  // to 3) and ended up confirming a score their opponent never saw. The
  // server enforces both rules; this just stops offering the buttons.
  const scoreSubmitted = !!mySubmission || !!otherSubmission;
  const canPlay =
    !completed &&
    !raceReached &&
    !scoreSubmitted &&
    (isPlayer || isStaff) &&
    !!match.homePlayer &&
    !!match.awayPlayer;

  // The score under discussion: whatever was submitted first, else the log.
  // Both players must be confirming the SAME pair of numbers.
  const pending = mySubmission ?? otherSubmission;
  const proposedHome = pending ? pending.homeScore : homeWins;
  const proposedAway = pending ? pending.awayScore : awayWins;
  // Round-81 — staff resolve from the FULL list. my/otherSubmission split the
  // two players arbitrarily for a non-player viewer, so the organizer only
  // ever saw one of the two scores to finalize.
  const staffNeedsToResolve = isStaff && !isPlayer && allSubmissions.length > 0;
  const distinctScores = Array.from(
    new Map(
      allSubmissions.map((sub) => [`${sub.homeScore}-${sub.awayScore}`, sub]),
    ).values(),
  );
  const canConfirm = !completed && raceReached && decided.length > 0;
  const nameFor = (id: string) =>
    match.homePlayer?.id === id
      ? match.homePlayer?.name
      : match.awayPlayer?.id === id
        ? match.awayPlayer?.name
        : "The other player";

  async function confirmScore(as: "player" | "staff") {
    const fn = as === "staff" ? onOrganizerConfirm : onSubmitScore;
    if (!fn) return;
    setConfirming(true);
    try {
      await fn(proposedHome, proposedAway);
      toast.success(
        as === "staff" ? "Result confirmed" : "Your score is in",
        as === "staff"
          ? undefined
          : "The match completes once your opponent confirms the same score.",
      );
    } catch (e) {
      toast.error(
        "Could not confirm",
        errorText(e, "Try again."),
      );
    } finally {
      setConfirming(false);
    }
  }

  async function record(homeWon: boolean) {
    const nextFrame =
      Math.max(0, ...match.frames.map((f) => f.frameNumber)) + 1;
    try {
      await recordFrame({
        variables: {
          input: {
            matchId: match.id,
            frameNumber: nextFrame,
            homeWon,
            breakAndRun: br,
          },
        },
      });
      setBr(false);
      await onChanged();
    } catch (e) {
      toast.error("Could not record frame", errorText(e, "Try again."));
    }
  }

  const winnerSide = completed
    ? (match.homeScore ?? homeWins) > (match.awayScore ?? awayWins)
      ? "home"
      : "away"
    : null;

  return (
    <div className="space-y-4">
      {/* Scoreboard */}
      <div className="flex items-center justify-center gap-4 rounded-xl border border-border bg-secondary/20 px-4 py-5">
        <PlayerSide player={match.homePlayer} won={winnerSide === "home"} />
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Race to {raceTo}
          </span>
          <div className="flex items-center gap-2 text-3xl font-bold tabular-nums">
            <span className={winnerSide === "home" ? "text-primary" : "text-white/90"}>
              {match.homeScore ?? homeWins}
            </span>
            <span className="text-muted-foreground">:</span>
            <span className={winnerSide === "away" ? "text-primary" : "text-white/90"}>
              {match.awayScore ?? awayWins}
            </span>
          </div>
          {completed ? (
            <span className="text-xs font-semibold text-primary">Final</span>
          ) : null}
        </div>
        <PlayerSide player={match.awayPlayer} won={winnerSide === "away"} align="right" />
      </div>

      {/* Record controls */}
      {canPlay ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-center text-xs text-muted-foreground">
            Who won the next frame?
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" loading={loading} onClick={() => record(true)}>
              {match.homePlayer?.name ?? "Home"}
            </Button>
            <Button variant="outline" loading={loading} onClick={() => record(false)}>
              {match.awayPlayer?.name ?? "Away"}
            </Button>
          </div>
          {brRule ? (
            <label className="flex cursor-pointer items-center justify-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={br}
                onChange={(e) => setBr(e.target.checked)}
                className="size-3.5 accent-primary"
              />
              This frame was a Break &amp; Run
            </label>
          ) : null}
        </div>
      ) : null}

      {/* Round-79 — dual confirmation. Replaces the old behaviour where the
          frame that hit the race-to target silently completed the match. */}
      {!completed && (isPlayer || isStaff) ? (
        <div
          className="space-y-3 rounded-lg border border-border p-3"
          data-testid="singles-confirm-panel"
        >
          {hasConflict ? (
            <div
              className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
              data-testid="singles-conflict"
            >
              <div className="font-semibold text-destructive">
                Scores don&apos;t match
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {staffNeedsToResolve
                  ? "The players submitted different scores. Pick the correct one below, or set your own."
                  : `${
                      mySubmission
                        ? `You submitted ${mySubmission.homeScore}–${mySubmission.awayScore}`
                        : "One score is in"
                    }${
                      otherSubmission
                        ? `, ${nameFor(otherSubmission.submittedBy.id)} submitted ${otherSubmission.homeScore}–${otherSubmission.awayScore}`
                        : ""
                    }. The organizer will settle it.`}
              </p>
            </div>
          ) : staffNeedsToResolve ? null : mySubmission ? (
            <p
              className="text-center text-sm text-muted-foreground"
              data-testid="singles-awaiting-opponent"
            >
              You confirmed{" "}
              <span className="font-semibold text-foreground">
                {mySubmission.homeScore}–{mySubmission.awayScore}
              </span>
              . Waiting on your opponent to confirm the same score.
            </p>
          ) : otherSubmission ? (
            <p className="text-center text-sm text-muted-foreground">
              {nameFor(otherSubmission.submittedBy.id)} submitted{" "}
              <span className="font-semibold text-foreground">
                {otherSubmission.homeScore}–{otherSubmission.awayScore}
              </span>
              . Confirm it to finish the match, or disagree and the organizer
              will settle it — the frame log is locked until then.
            </p>
          ) : canConfirm ? (
            <p className="text-center text-sm text-muted-foreground">
              Race to {raceTo} reached — no more frames. Both players confirm
              the final score to complete the match.
            </p>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Keep recording frames — the match can be confirmed once someone
              reaches {raceTo}.
            </p>
          )}

          {(canConfirm || otherSubmission) && (isPlayer || isStaff) ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {isPlayer && !mySubmission ? (
                <Button
                  variant="primary"
                  loading={confirming}
                  onClick={() => confirmScore("player")}
                  data-testid="singles-submit-score"
                >
                  Confirm {proposedHome}–{proposedAway}
                </Button>
              ) : null}
              {/* Round-80 — the log is frozen once a score is submitted, so
                  both players would otherwise only ever be able to confirm the
                  SAME number and a wrong log could never be challenged. This
                  is the way out: enter what you think the score was, which
                  lands as a CONFLICT for the organizer to settle. */}
              {isPlayer && !mySubmission && otherSubmission ? (
                <Button
                  variant="outline"
                  disabled={confirming}
                  onClick={() => {
                    setDisputeHome(String(otherSubmission.homeScore));
                    setDisputeAway(String(otherSubmission.awayScore));
                    setDisputing((v) => !v);
                  }}
                  data-testid="singles-dispute-toggle"
                >
                  That&apos;s not right
                </Button>
              ) : null}
              {isStaff && !staffNeedsToResolve ? (
                <Button
                  variant={isPlayer ? "outline" : "primary"}
                  loading={confirming}
                  onClick={() => confirmScore("staff")}
                  data-testid="singles-staff-confirm"
                >
                  Finalize as organizer ({proposedHome}–{proposedAway})
                </Button>
              ) : null}
            </div>
          ) : null}

          {/* Round-81 — organizer/admin view of the submitted scores. Both
              are listed with their author so the decision is made against the
              actual disagreement, not whichever row happened to load first. */}
          {staffNeedsToResolve ? (
            <div className="space-y-2" data-testid="singles-staff-resolve">
              <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {distinctScores.length > 1
                  ? "Pick the correct score"
                  : "Submitted score"}
              </p>
              {/* The name on each row is the SUBMITTER; the numbers always
                  read home–away. Spell that out so "Sofia — 3–0" can't be
                  misread as Sofia having won 3. */}
              <p className="text-center text-xs text-muted-foreground">
                Scores read {match.homePlayer?.name ?? "Home"} –{" "}
                {match.awayPlayer?.name ?? "Away"}
              </p>
              <ul className="space-y-1.5">
                {allSubmissions.map((sub) => (
                  <li
                    key={sub.id}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {sub.submittedBy.name}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {sub.homeScore}–{sub.awayScore}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      loading={confirming}
                      onClick={async () => {
                        if (!onOrganizerConfirm) return;
                        setConfirming(true);
                        try {
                          await onOrganizerConfirm(sub.homeScore, sub.awayScore);
                          toast.success("Result confirmed");
                        } catch (e) {
                          toast.error(
                            "Could not confirm",
                            errorText(e, "Try again."),
                          );
                        } finally {
                          setConfirming(false);
                        }
                      }}
                      data-testid={`singles-staff-pick-${sub.id}`}
                    >
                      Use this
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="rounded-md border border-border bg-background p-3">
                <p className="text-center text-xs text-muted-foreground">
                  Or set a different final score
                </p>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <ScoreInput
                    label={match.homePlayer?.name ?? "Home"}
                    value={staffHome}
                    onChange={setStaffHome}
                    testId="staff-home"
                  />
                  <span className="text-muted-foreground">:</span>
                  <ScoreInput
                    label={match.awayPlayer?.name ?? "Away"}
                    value={staffAway}
                    onChange={setStaffAway}
                    testId="staff-away"
                  />
                </div>
                <div className="mt-2 flex justify-center">
                  <Button
                    size="sm"
                    variant="primary"
                    loading={confirming}
                    disabled={staffHome === "" || staffAway === ""}
                    onClick={async () => {
                      if (!onOrganizerConfirm) return;
                      setConfirming(true);
                      try {
                        await onOrganizerConfirm(
                          Math.max(0, Number(staffHome) || 0),
                          Math.max(0, Number(staffAway) || 0),
                        );
                        toast.success("Result confirmed");
                      } catch (e) {
                        toast.error(
                          "Could not confirm",
                          errorText(e, "Try again."),
                        );
                      } finally {
                        setConfirming(false);
                      }
                    }}
                    data-testid="singles-staff-custom"
                  >
                    Finalize as organizer
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {disputing && isPlayer && !mySubmission ? (
            <div
              className="space-y-2 rounded-md border border-border bg-background p-3"
              data-testid="singles-dispute-editor"
            >
              <p className="text-center text-xs text-muted-foreground">
                What was the final score?
              </p>
              <div className="flex items-center justify-center gap-2">
                <ScoreInput
                  label={match.homePlayer?.name ?? "Home"}
                  value={disputeHome}
                  onChange={setDisputeHome}
                  testId="dispute-home"
                />
                <span className="text-muted-foreground">:</span>
                <ScoreInput
                  label={match.awayPlayer?.name ?? "Away"}
                  value={disputeAway}
                  onChange={setDisputeAway}
                  testId="dispute-away"
                />
              </div>
              <div className="flex justify-center">
                <Button
                  variant="primary"
                  size="sm"
                  loading={confirming}
                  onClick={async () => {
                    if (!onSubmitScore) return;
                    const h = Math.max(0, Number(disputeHome) || 0);
                    const a = Math.max(0, Number(disputeAway) || 0);
                    setConfirming(true);
                    try {
                      await onSubmitScore(h, a);
                      setDisputing(false);
                      toast.success(
                        h === otherSubmission?.homeScore &&
                          a === otherSubmission?.awayScore
                          ? "Score confirmed"
                          : "Sent to the organizer",
                        h === otherSubmission?.homeScore &&
                          a === otherSubmission?.awayScore
                          ? undefined
                          : "Your scores differ — the organizer will settle it.",
                      );
                    } catch (e) {
                      toast.error(
                        "Could not submit",
                        errorText(e, "Try again."),
                      );
                    } finally {
                      setConfirming(false);
                    }
                  }}
                  data-testid="singles-dispute-send"
                >
                  Submit my score
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Frame log */}
      {decided.length > 0 ? (
        <div className="rounded-lg border border-border">
          <div className="border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
            Frames
          </div>
          <ol className="divide-y divide-border/60">
            {decided
              .slice()
              .sort((a, b) => a.frameNumber - b.frameNumber)
              .map((f) => (
                <li
                  key={f.frameNumber}
                  className="flex items-center justify-between px-3 py-1.5 text-sm"
                >
                  <span className="text-xs text-muted-foreground">
                    Frame {f.frameNumber}
                  </span>
                  <span className="font-medium">
                    {f.homeWon
                      ? match.homePlayer?.name
                      : match.awayPlayer?.name}
                    {f.breakAndRun ? (
                      <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-primary">
                        B&amp;R
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
          </ol>
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          No frames recorded yet.
        </p>
      )}
    </div>
  );
}

function ScoreInput({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId: string;
}) {
  return (
    <label className="flex flex-col items-center gap-1">
      <span className="max-w-24 truncate text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-16 rounded-md border border-border bg-background px-2 py-1.5 text-center text-sm outline-none focus:border-primary"
        data-testid={testId}
      />
    </label>
  );
}

function PlayerSide({
  player,
  won,
  align = "left",
}: {
  player: Player;
  won: boolean;
  align?: "left" | "right";
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <Avatar
        size="md"
        src={player?.avatarUrl ?? undefined}
        fallback={player?.name ?? "TBD"}
        ghost={player?.isShell ?? false}
      />
      <div
        className={`flex items-center gap-1.5 text-center text-sm font-medium ${
          won ? "text-primary" : "text-white/90"
        }`}
      >
        {player?.name ?? "TBD"}
        {player?.nationality ? (
          <CountryFlag code={player.nationality} className="leading-none" />
        ) : null}
      </div>
    </div>
  );
}
