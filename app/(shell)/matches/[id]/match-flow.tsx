"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useSubscription } from "@apollo/client/react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchStatusChip } from "@/components/ui/status-chip";
import { ImageThumbnails } from "@/components/ui/image-lightbox";
import { DetailHero } from "@/components/layout/detail-hero";
import { useToast } from "@/components/ui/toast";
import { MatchDetailQuery, SubmitMatchResultMutation } from "@/lib/graphql/operations/match.operations";
import {
  SubmitMatchScoreMutation,
  MatchScoreSubmissionsForMatchQuery,
} from "@/lib/graphql/operations/score-submission.operations";
import { MatchUpdatedSubscription } from "@/lib/graphql/operations/subscriptions.operations";
import { ViewerQuery } from "@/lib/graphql/operations/competition.operations";
import { MatchAdminActions } from "./match-admin-actions";
import { MatchLineups, type MatchLineupsData } from "@/components/match/match-lineups";

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
  const [submitResult, { loading: submitting, error: submitError }] = useMutation(
    SubmitMatchResultMutation,
  );
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

  const match = data?.match;
  if (loading && !match) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!match) {
    return <div className="p-8 text-sm text-muted-foreground">Match not found.</div>;
  }
  const homeWins = match.frames.filter((f) => f.homeWon === true).length;
  const awayWins = match.frames.filter((f) => f.homeWon === false).length;
  const undecided = match.frames.filter((f) => f.homeWon == null).length;
  const completed = match.status === "COMPLETED";
  const matchId = match.id;

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

  // Round-60 — all games decided once no block is still active.
  const allDecided =
    !completed &&
    match.frames.length > 0 &&
    undecided === 0 &&
    match.currentActiveBlockOrder == null;

  return (
    <div className="flex flex-col">
      <DetailHero
        title={`${match.homeTeam?.name ?? "TBD"} vs ${match.awayTeam?.name ?? "TBD"}`}
        meta={
          <>
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
            <MatchStatusChip status={match.status} />
            {match.winType && match.winType !== "NORMAL" ? (
              <Badge variant="warning">
                {match.winType === "DOUBLE_FORFEIT"
                  ? "Double forfeit"
                  : "Walkover"}
              </Badge>
            ) : null}
            {match.venue ? <span>{match.venue.name}</span> : null}
          </>
        }
      />

      <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-6 md:px-10">
        {/* Figma "Match Details" panel: compact scoreboard + per-block lineups. */}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold">Match Details</h2>
          </div>

          {/* Compact scoreboard */}
          <div className="flex items-center justify-center gap-6 border-b border-border bg-secondary/20 px-6 py-5">
            <ScoreTeam name={match.homeTeam?.name} logoUrl={match.homeTeam?.logoUrl} />
            <div className="flex flex-col items-center gap-2">
              <MatchStatusChip status={match.status} />
              <div className="flex items-center gap-1">
                <ScoreBox
                  value={match.homeScore ?? homeWins}
                  won={completed && homeWins > awayWins}
                  lost={completed && homeWins < awayWins}
                />
                <span className="px-1 text-sm text-muted-foreground">:</span>
                <ScoreBox
                  value={match.awayScore ?? awayWins}
                  won={completed && awayWins > homeWins}
                  lost={completed && awayWins < homeWins}
                />
              </div>
            </div>
            <ScoreTeam name={match.awayTeam?.name} logoUrl={match.awayTeam?.logoUrl} />
          </div>
          {match.venue ? (
            <div className="flex items-center justify-center gap-1.5 border-b border-border px-6 py-2 text-xs text-muted-foreground">
              <MapPin className="size-3" /> {match.venue.name}
            </div>
          ) : null}

          <div className="space-y-4 px-6 py-6">
            <MatchLineups
              match={match as unknown as MatchLineupsData}
              viewerId={viewerId ?? null}
              viewerRole={viewer?.role ?? null}
              onChanged={async () => {
                await refetch();
              }}
            />

            {/* Confirm + proof — once all games are decided (Figma screens 9–10). */}
            {!completed && allDecided && (isCaptain || isAdmin) ? (
              <div className="space-y-3 border-t border-border pt-6 text-center">
                <p className="text-base font-semibold text-primary">
                  All Games are played. Confirm Match Results
                </p>
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
              </div>
            ) : null}

            {completed && autoApproved ? (
              <div className="rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
                Both captains agreed — match auto-approved.
              </div>
            ) : null}
          </div>
        </div>

        {/* Round-31 — audit panel: who/when accepted the final score. */}
        {completed ? (
          <ResultAuditCard
            completedAt={match.completedAt ?? null}
            completionMode={match.completionMode ?? null}
            completedBy={match.completedBy ?? null}
          />
        ) : null}

        {/* Round-31 — submissions trail: both captains' submissions side by side. */}
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
      </div>
    </div>
  );
}

function ScoreTeam({
  name,
  logoUrl,
}: {
  name?: string | null;
  logoUrl?: string | null;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <Avatar size="md" src={logoUrl ?? undefined} fallback={name ?? "TBD"} shape="team" />
      <span className="text-center text-sm font-medium text-white/90">{name ?? "TBD"}</span>
    </div>
  );
}

function ScoreBox({
  value,
  won,
  lost,
}: {
  value: number;
  won: boolean;
  lost: boolean;
}) {
  const cls = won
    ? "bg-[#005f5a] text-[#96f7e4]"
    : lost
      ? "bg-[#861043] text-[#fccee8]"
      : "bg-white/10 text-white/90";
  return (
    <div className={`flex size-8 items-center justify-center rounded text-base font-semibold tabular-nums ${cls}`}>
      {value}
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
                <ImageThumbnails
                  images={s.boardImageUrls!}
                  alt="Score board"
                  className="mt-2 flex flex-wrap gap-1.5"
                  testIdPrefix={`submission-photo-${s.id}`}
                />
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
