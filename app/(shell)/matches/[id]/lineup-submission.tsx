"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import {
  ApproveLineupEditMutation,
  RejectLineupEditMutation,
  RequestLineupEditMutation,
  SubmitLineupMutation,
  TeamRosterQuery,
} from "@/lib/graphql/operations/match.operations";

type Block = {
  id: string;
  order: number;
  type: "SINGLES" | "DOUBLES" | "SCOTCH_DOUBLES" | string;
  games: number;
  raceTo?: number | null;
  breakAfterMin?: number | null;
};

type ScaffoldRow =
  | {
      kind: "frame";
      frameNumber: number;
      type: "SINGLES" | "DOUBLES" | "SCOTCH_DOUBLES";
    }
  | { kind: "break"; afterBlockOrder: number; minutes: number };

function buildScaffold(blocks: Block[]): ScaffoldRow[] {
  const sorted = [...blocks].sort((a, b) => a.order - b.order);
  const out: ScaffoldRow[] = [];
  let n = 0;
  for (const b of sorted) {
    const type = b.type as ScaffoldRow extends { type: infer T } ? T : never;
    for (let i = 0; i < b.games; i++) {
      n += 1;
      out.push({ kind: "frame", frameNumber: n, type: type as "SINGLES" });
    }
    if (b.breakAfterMin && b.breakAfterMin > 0) {
      out.push({
        kind: "break",
        afterBlockOrder: b.order,
        minutes: b.breakAfterMin,
      });
    }
  }
  return out;
}

/**
 * Round-14 — captain-facing Match Flow lineup submission.
 *
 *  - Slots are derived from the competition's MatchFormatBlock list (Singles
 *    rows take one player; Doubles / Scotch take two; a break renders as a
 *    separator).
 *  - The opponent's lineup stays HIDDEN until both sides submit. A captain
 *    can EDIT their own lineup until the opponent submits, then both lock.
 *  - On submit we call `submitLineup` (server validates roster membership
 *    + no-double-assignment + the both-submitted gate).
 */
export function LineupSubmission({
  matchId,
  blocks,
  viewerId,
  viewerRole,
  matchStatus,
  homeTeam,
  awayTeam,
  homeLineupSubmittedAt,
  awayLineupSubmittedAt,
  lineupEditRequestedAt,
  lineupEditRequestedById,
  lineupEditRequestedSide,
  frames,
  onSubmitted,
}: {
  matchId: string;
  blocks: Block[];
  viewerId: string | undefined;
  viewerRole: string | undefined;
  matchStatus: string;
  homeTeam: { id: string; name: string; captain?: { id: string } | null } | null;
  awayTeam: { id: string; name: string; captain?: { id: string } | null } | null;
  homeLineupSubmittedAt: string | null;
  awayLineupSubmittedAt: string | null;
  lineupEditRequestedAt: string | null;
  lineupEditRequestedById: string | null;
  lineupEditRequestedSide: string | null;
  frames: Array<{
    frameNumber: number;
    homePlayerRef?: { id: string; name: string; avatarUrl?: string | null } | null;
    awayPlayerRef?: { id: string; name: string; avatarUrl?: string | null } | null;
  }>;
  onSubmitted: () => void | Promise<void>;
}) {
  const toast = useToast();

  const isHomeCaptain = !!viewerId && homeTeam?.captain?.id === viewerId;
  const isAwayCaptain = !!viewerId && awayTeam?.captain?.id === viewerId;
  const side: "home" | "away" | null = isHomeCaptain
    ? "home"
    : isAwayCaptain
      ? "away"
      : null;
  const isAdmin = viewerRole === "SUPER_ADMIN";

  const ourTeamId = side === "home" ? homeTeam?.id : awayTeam?.id;
  const rosterQuery = useQuery(TeamRosterQuery, {
    variables: { id: ourTeamId ?? "" },
    skip: !ourTeamId,
  });
  const rosterMembers = rosterQuery.data?.teamById?.members ?? [];

  const scaffold = useMemo(() => buildScaffold(blocks), [blocks]);
  const frameRows = scaffold.filter(
    (r): r is Extract<ScaffoldRow, { kind: "frame" }> => r.kind === "frame",
  );

  const bothSubmitted =
    !!homeLineupSubmittedAt && !!awayLineupSubmittedAt;
  const ourSubmitted =
    side === "home"
      ? !!homeLineupSubmittedAt
      : side === "away"
        ? !!awayLineupSubmittedAt
        : false;
  const oppSubmitted =
    side === "home"
      ? !!awayLineupSubmittedAt
      : side === "away"
        ? !!homeLineupSubmittedAt
        : false;
  // We can edit until the OPPONENT submits — then both lock.
  const locked = ourSubmitted && oppSubmitted;
  const canEdit = !!side && !locked;

  // Local assignment state — keyed by frameNumber. Doubles uses an array.
  const [picks, setPicks] = useState<
    Record<number, { primary?: string; partner?: string }>
  >(() => {
    const initial: Record<number, { primary?: string; partner?: string }> = {};
    for (const f of frames) {
      if (f.homePlayerRef && side === "home") {
        initial[f.frameNumber] = { primary: f.homePlayerRef.id };
      } else if (f.awayPlayerRef && side === "away") {
        initial[f.frameNumber] = { primary: f.awayPlayerRef.id };
      }
    }
    return initial;
  });

  const [submit, { loading: submitting }] = useMutation(SubmitLineupMutation);
  const [requestEdit, { loading: requesting }] = useMutation(
    RequestLineupEditMutation,
  );
  const [approveEdit, { loading: approving }] = useMutation(
    ApproveLineupEditMutation,
  );
  const [rejectEdit, { loading: rejecting }] = useMutation(
    RejectLineupEditMutation,
  );

  const editPending = !!lineupEditRequestedAt;
  const iAmRequester =
    editPending && !!viewerId && lineupEditRequestedById === viewerId;
  const iCanRespond = editPending && !!side && !iAmRequester;
  // The captain can ask for an edit only when both lineups are locked AND the
  // match hasn't started — once frames are being played, edits could rewrite
  // history. SUPER_ADMIN can always override via direct mutation.
  const canRequestEdit =
    !!side && bothSubmitted && !editPending && matchStatus === "SCHEDULED";

  async function onRequestEdit() {
    try {
      await requestEdit({ variables: { matchId } });
      toast.success("Edit request sent to your opponent");
      await onSubmitted();
    } catch (e) {
      toast.error(
        "Could not request edit",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  async function onApprove() {
    try {
      await approveEdit({ variables: { matchId } });
      toast.success("Edit approved — lineups re-opened");
      await onSubmitted();
    } catch (e) {
      toast.error(
        "Could not approve",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  async function onReject() {
    try {
      await rejectEdit({ variables: { matchId } });
      toast.success("Edit request rejected");
      await onSubmitted();
    } catch (e) {
      toast.error(
        "Could not reject",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  async function onSubmit() {
    const slots = frameRows
      .filter((row) => picks[row.frameNumber]?.primary)
      .map((row) => ({
        frameNumber: row.frameNumber,
        playerId: picks[row.frameNumber]!.primary!,
        partnerPlayerId:
          row.type !== "SINGLES" ? picks[row.frameNumber]?.partner : null,
      }));
    if (slots.length !== frameRows.length) {
      toast.error("Lineup incomplete", "Pick a player for every slot.");
      return;
    }
    // Doubles slots need a partner too.
    for (const row of frameRows) {
      if (row.type !== "SINGLES" && !picks[row.frameNumber]?.partner) {
        toast.error(
          "Pick a partner",
          `${row.type.replace("_", " ")} game ${row.frameNumber} needs two players.`,
        );
        return;
      }
    }
    try {
      await submit({ variables: { input: { matchId, slots } } });
      toast.success("Lineup submitted");
      await onSubmitted();
    } catch (e) {
      toast.error(
        "Could not submit lineup",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  // Audience view (not a captain) — show locked state.
  if (!side && !isAdmin) {
    return (
      <Card data-testid="lineup-submission-public">
        <CardHeader>
          <CardTitle>Match lineup</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Lineups are hidden until both team captains submit.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="lineup-submission">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Submit your lineup</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={ourSubmitted ? "success" : "neutral"} size="sm">
              You: {ourSubmitted ? "submitted" : "draft"}
            </Badge>
            <Badge variant={oppSubmitted ? "success" : "neutral"} size="sm">
              Opponent: {oppSubmitted ? "submitted" : "waiting"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {iCanRespond ? (
          <div
            className="space-y-2 rounded-md border border-teal-500/40 bg-teal-500/10 px-3 py-2 text-xs text-teal-200"
            data-testid="lineup-edit-incoming"
          >
            <p className="font-semibold text-teal-100">
              Opponent Requested Edit
            </p>
            <p>You will be able to edit your lineup as well.</p>
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="success"
                onClick={onApprove}
                loading={approving}
                data-testid="lineup-edit-approve"
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={onReject}
                loading={rejecting}
                data-testid="lineup-edit-reject"
              >
                Reject
              </Button>
            </div>
          </div>
        ) : iAmRequester ? (
          <p
            className="rounded-md border border-teal-500/40 bg-teal-500/10 px-3 py-2 text-xs text-teal-200"
            data-testid="lineup-edit-pending"
          >
            Edit request sent — waiting on the opponent to approve.
          </p>
        ) : bothSubmitted ? (
          <p className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs text-success">
            Both lineups submitted — locked.
          </p>
        ) : ourSubmitted ? (
          <p className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary">
            Waiting on the opponent. You can still edit until they submit.
          </p>
        ) : (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
            Lineups are hidden until both captains submit.
          </p>
        )}

        <ol className="space-y-2" data-testid="lineup-rows">
          {scaffold.map((row, idx) =>
            row.kind === "break" ? (
              <li
                key={`brk-${idx}`}
                className="flex items-center justify-center gap-2 rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs font-medium text-amber-300"
              >
                <span aria-hidden>⏸</span>
                Break Time for Next Lineup — {row.minutes} min
              </li>
            ) : (
              <li
                key={`f-${row.frameNumber}`}
                className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
                data-testid={`lineup-slot-${row.frameNumber}`}
              >
                {/* Row number on the left — matches Figma 1, 2, 3... indicator */}
                <span
                  aria-hidden
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary/60 text-xs font-bold tabular-nums text-muted-foreground"
                >
                  {row.frameNumber}
                </span>
                <Badge
                  variant={row.type === "SINGLES" ? "primary" : "info"}
                  size="sm"
                >
                  {row.type === "SINGLES"
                    ? "Singles"
                    : row.type === "DOUBLES"
                      ? "Doubles"
                      : "Scotch Doubles"}
                </Badge>
                <div className="ml-auto flex flex-1 items-center justify-end gap-2">
                  <select
                    disabled={!canEdit}
                    value={picks[row.frameNumber]?.primary ?? ""}
                    onChange={(e) =>
                      setPicks((p) => ({
                        ...p,
                        [row.frameNumber]: {
                          ...p[row.frameNumber],
                          primary: e.target.value || undefined,
                        },
                      }))
                    }
                    className="h-9 max-w-[200px] flex-1 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="">
                      {row.type === "SINGLES"
                        ? "Select Player"
                        : "Select Player 1"}
                    </option>
                    {rosterMembers.map((m) => (
                      <option key={m.user.id} value={m.user.id}>
                        {m.user.name}
                      </option>
                    ))}
                  </select>
                  {row.type !== "SINGLES" ? (
                    <select
                      disabled={!canEdit}
                      value={picks[row.frameNumber]?.partner ?? ""}
                      onChange={(e) =>
                        setPicks((p) => ({
                          ...p,
                          [row.frameNumber]: {
                            ...p[row.frameNumber],
                            partner: e.target.value || undefined,
                          },
                        }))
                      }
                      className="h-9 max-w-[200px] flex-1 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">Select Player 2</option>
                      {rosterMembers.map((m) => (
                        <option key={m.user.id} value={m.user.id}>
                          {m.user.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
                {/* Opponent's lineup only visible after both submit. */}
                {bothSubmitted ? (
                  <div className="ml-2 hidden text-xs text-muted-foreground md:block">
                    <span className="font-semibold">vs </span>
                    {(side === "home"
                      ? frames.find((f) => f.frameNumber === row.frameNumber)
                          ?.awayPlayerRef
                      : frames.find((f) => f.frameNumber === row.frameNumber)
                          ?.homePlayerRef
                    )?.name ?? "—"}
                  </div>
                ) : null}
              </li>
            ),
          )}
        </ol>

        {canEdit ? (
          <div className="flex justify-end pt-2">
            <Button onClick={onSubmit} loading={submitting}>
              {ourSubmitted ? "Update lineup" : "Submit lineup"}
            </Button>
          </div>
        ) : null}

        {canRequestEdit ? (
          <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Need to swap a player? Ask your opponent to re-open the lineup.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={onRequestEdit}
              loading={requesting}
              data-testid="lineup-request-edit"
            >
              Request edit
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// Avoid the unused-import warning when the file imports `Avatar`.
void Avatar;
