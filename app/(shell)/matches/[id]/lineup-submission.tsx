"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { AlertCircle, CheckCircle2, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CountryFlag } from "@/components/ui/country-flag";
import { Select, type SelectOption } from "@/components/ui/select";
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
  const rosterMembers = useMemo(
    () => rosterQuery.data?.teamById?.members ?? [],
    [rosterQuery.data?.teamById?.members],
  );

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

  // Round-50 — derive "who's used where" by category. Per the league rule
  // a player can hold AT MOST one SINGLES slot AND at most one DOUBLES
  // (incl. Scotch) slot — so a player picked for a singles game is still
  // free to be a doubles partner in a different frame. The server enforces
  // the same two-bucket rule (per-block-type seen sets); this is purely a
  // UX accelerator so the conflict surfaces before the round-trip.
  type SlotCategory = "SINGLES" | "DOUBLES";
  type UsedSlot = {
    frameNumber: number;
    role: "primary" | "partner";
    category: SlotCategory;
  };
  const usedBy: Map<string, UsedSlot[]> = useMemo(() => {
    const map = new Map<string, UsedSlot[]>();
    for (const row of frameRows) {
      const cell = picks[row.frameNumber];
      if (!cell) continue;
      const category: SlotCategory =
        row.type === "SINGLES" ? "SINGLES" : "DOUBLES";
      if (cell.primary) {
        const list = map.get(cell.primary) ?? [];
        list.push({
          frameNumber: row.frameNumber,
          role: "primary",
          category,
        });
        map.set(cell.primary, list);
      }
      if (cell.partner) {
        const list = map.get(cell.partner) ?? [];
        list.push({
          frameNumber: row.frameNumber,
          role: "partner",
          category,
        });
        map.set(cell.partner, list);
      }
    }
    return map;
  }, [frameRows, picks]);

  type RowIssue =
    | { kind: "missing-primary" }
    | { kind: "missing-partner" }
    | { kind: "duplicate-couple" }
    | {
        kind: "duplicate-player";
        playerId: string;
        otherFrame: number;
        otherRole: "primary" | "partner";
        role: "primary" | "partner";
      };
  const rowIssues = useMemo(() => {
    const out = new Map<number, RowIssue[]>();
    for (const row of frameRows) {
      const cell = picks[row.frameNumber];
      const list: RowIssue[] = [];
      const rowCategory: SlotCategory =
        row.type === "SINGLES" ? "SINGLES" : "DOUBLES";
      if (!cell?.primary) {
        list.push({ kind: "missing-primary" });
      }
      if (row.type !== "SINGLES" && !cell?.partner) {
        list.push({ kind: "missing-partner" });
      }
      if (
        row.type !== "SINGLES" &&
        cell?.primary &&
        cell?.partner &&
        cell.primary === cell.partner
      ) {
        list.push({ kind: "duplicate-couple" });
      }
      // Duplicate within the same category: a player can only hold ONE
      // singles slot AND one doubles slot — but a singles player can still
      // be a doubles partner in a different frame, so the conflict is
      // category-scoped.
      for (const [role, pid] of [
        ["primary", cell?.primary] as const,
        ["partner", cell?.partner] as const,
      ]) {
        if (!pid) continue;
        const uses = usedBy.get(pid) ?? [];
        const other = uses.find(
          (u) =>
            u.category === rowCategory &&
            !(u.frameNumber === row.frameNumber && u.role === role),
        );
        if (other) {
          list.push({
            kind: "duplicate-player",
            playerId: pid,
            otherFrame: other.frameNumber,
            otherRole: other.role,
            role,
          });
        }
      }
      if (list.length > 0) out.set(row.frameNumber, list);
    }
    return out;
  }, [frameRows, picks, usedBy]);

  const memberById = useMemo(() => {
    const m = new Map<string, { id: string; name: string; avatarUrl?: string | null }>();
    for (const r of rosterMembers) m.set(r.user.id, r.user);
    return m;
  }, [rosterMembers]);

  // Lineup summary — used vs. available players for the chip row.
  const usedPlayerIds = useMemo(() => Array.from(usedBy.keys()), [usedBy]);
  const availablePlayers = useMemo(
    () => rosterMembers.filter((m) => !usedBy.has(m.user.id)),
    [rosterMembers, usedBy],
  );

  const blockingIssueCount = useMemo(() => {
    let n = 0;
    for (const issues of rowIssues.values()) {
      for (const i of issues) {
        // missing-primary / missing-partner are only blocking once the
        // captain actually tries to submit; conflicts always block.
        if (
          i.kind === "duplicate-couple" ||
          i.kind === "duplicate-player"
        ) {
          n += 1;
        }
      }
    }
    return n;
  }, [rowIssues]);

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
    // Pre-submit guard — surface specific issues instead of a generic
    // server bounce. Rules mirror the resolver: every slot filled, doubles
    // get two players, no player repeats across slots (including within a
    // doubles couple).
    const missingRows: number[] = [];
    const partnerMissingRows: number[] = [];
    const duplicateCoupleRows: number[] = [];
    const duplicatePlayers: Array<{
      name: string;
      category: "SINGLES" | "DOUBLES";
      frames: number[];
    }> = [];
    // Per-category tracker — matches the server rule (one singles slot AND
    // one doubles slot max per player). A singles player can still appear
    // in a doubles couple.
    const singlesFrames = new Map<string, Set<number>>();
    const doublesFrames = new Map<string, Set<number>>();
    for (const row of frameRows) {
      const cell = picks[row.frameNumber];
      if (!cell?.primary) missingRows.push(row.frameNumber);
      if (row.type !== "SINGLES" && !cell?.partner)
        partnerMissingRows.push(row.frameNumber);
      if (
        row.type !== "SINGLES" &&
        cell?.primary &&
        cell?.partner &&
        cell.primary === cell.partner
      ) {
        duplicateCoupleRows.push(row.frameNumber);
      }
      const bucket = row.type === "SINGLES" ? singlesFrames : doublesFrames;
      for (const pid of [cell?.primary, cell?.partner]) {
        if (!pid) continue;
        const set = bucket.get(pid) ?? new Set<number>();
        set.add(row.frameNumber);
        bucket.set(pid, set);
      }
    }
    for (const [pid, frameSet] of singlesFrames) {
      if (frameSet.size > 1) {
        duplicatePlayers.push({
          name: memberById.get(pid)?.name ?? pid,
          category: "SINGLES",
          frames: Array.from(frameSet).sort((a, b) => a - b),
        });
      }
    }
    for (const [pid, frameSet] of doublesFrames) {
      if (frameSet.size > 1) {
        duplicatePlayers.push({
          name: memberById.get(pid)?.name ?? pid,
          category: "DOUBLES",
          frames: Array.from(frameSet).sort((a, b) => a - b),
        });
      }
    }
    if (missingRows.length > 0) {
      toast.error(
        "Lineup incomplete",
        `Pick a player for game${missingRows.length === 1 ? "" : "s"} ${missingRows.join(", ")}.`,
      );
      return;
    }
    if (partnerMissingRows.length > 0) {
      toast.error(
        "Pick a partner",
        `Game${partnerMissingRows.length === 1 ? "" : "s"} ${partnerMissingRows.join(", ")} need two players.`,
      );
      return;
    }
    if (duplicateCoupleRows.length > 0) {
      toast.error(
        "Pick two different players",
        `A doubles couple can't be the same player (game${duplicateCoupleRows.length === 1 ? "" : "s"} ${duplicateCoupleRows.join(", ")}).`,
      );
      return;
    }
    if (duplicatePlayers.length > 0) {
      const first = duplicatePlayers[0];
      toast.error(
        first.category === "SINGLES"
          ? "Player in two singles games"
          : "Player in two doubles couples",
        `${first.name} is in games ${first.frames.join(" & ")}. ${
          first.category === "SINGLES"
            ? "A player can only fill one singles slot."
            : "A player can only fill one doubles slot."
        }`,
      );
      return;
    }
    const slots = frameRows.map((row) => ({
      frameNumber: row.frameNumber,
      playerId: picks[row.frameNumber]!.primary!,
      partnerPlayerId:
        row.type !== "SINGLES" ? picks[row.frameNumber]?.partner : null,
    }));
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

        {/* Round-50 — Roster summary so captains see at a glance who's in
            and who's still free. Tap a chip to scroll its assigned row(s)
            (visual cue only). */}
        {canEdit && rosterMembers.length > 0 ? (
          <div
            className="rounded-md border border-border bg-background/60 p-3"
            data-testid="lineup-roster-summary"
          >
            <div className="mb-2 flex items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1 font-semibold text-muted-foreground">
                <Users className="size-3.5" />
                {usedPlayerIds.length} / {rosterMembers.length} assigned
              </span>
              {blockingIssueCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-destructive">
                  <AlertCircle className="size-3.5" />
                  {blockingIssueCount} conflict
                  {blockingIssueCount === 1 ? "" : "s"} to resolve
                </span>
              ) : usedPlayerIds.length === rosterMembers.length ||
                usedPlayerIds.length === frameRows.length ? (
                <span className="inline-flex items-center gap-1 text-success">
                  <CheckCircle2 className="size-3.5" />
                  Ready to submit
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {rosterMembers.map((m) => {
                const slots = usedBy.get(m.user.id) ?? [];
                const used = slots.length > 0;
                return (
                  <span
                    key={m.user.id}
                    className={
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] " +
                      (used
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground")
                    }
                    title={
                      used
                        ? `In game${slots.length > 1 ? "s" : ""} ${slots
                            .map((s) => s.frameNumber)
                            .join(", ")}`
                        : "Available"
                    }
                  >
                    <Avatar
                      size="sm"
                      src={m.user.avatarUrl ?? undefined}
                      fallback={m.user.name}
                    />
                    <span className="font-medium">
                      {m.user.name}
                      <CountryFlag
                        code={m.user.nationality}
                        className="ml-1 leading-none"
                      />
                    </span>
                    {used ? (
                      <span className="opacity-70">
                        · #{slots.map((s) => s.frameNumber).join(", ")}
                      </span>
                    ) : null}
                  </span>
                );
              })}
              {availablePlayers.length === 0 && rosterMembers.length > 0 ? (
                <span className="text-[11px] text-muted-foreground">
                  All players assigned.
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

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
              <LineupRow
                key={`f-${row.frameNumber}`}
                row={row}
                canEdit={canEdit}
                picks={picks[row.frameNumber] ?? {}}
                rosterMembers={rosterMembers}
                usedBy={usedBy}
                memberById={memberById}
                issues={rowIssues.get(row.frameNumber) ?? []}
                bothSubmitted={bothSubmitted}
                opponentFor={(frameNumber) => {
                  const frame = frames.find((f) => f.frameNumber === frameNumber);
                  return side === "home"
                    ? frame?.awayPlayerRef?.name ?? null
                    : frame?.homePlayerRef?.name ?? null;
                }}
                onChangePrimary={(value) =>
                  setPicks((p) => ({
                    ...p,
                    [row.frameNumber]: {
                      ...p[row.frameNumber],
                      primary: value,
                    },
                  }))
                }
                onChangePartner={(value) =>
                  setPicks((p) => ({
                    ...p,
                    [row.frameNumber]: {
                      ...p[row.frameNumber],
                      partner: value,
                    },
                  }))
                }
              />
            ),
          )}
        </ol>

        {canEdit ? (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <span className="text-xs text-muted-foreground">
              {blockingIssueCount > 0
                ? "Resolve conflicts above before submitting."
                : "A captain can re-edit until the opponent submits."}
            </span>
            <Button
              onClick={onSubmit}
              loading={submitting}
              disabled={blockingIssueCount > 0}
              data-testid="lineup-submit"
            >
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

type RosterMember = {
  id: string;
  user: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    nationality?: string | null;
  };
};

type LineupRowIssue =
  | { kind: "missing-primary" }
  | { kind: "missing-partner" }
  | { kind: "duplicate-couple" }
  | {
      kind: "duplicate-player";
      playerId: string;
      otherFrame: number;
      otherRole: "primary" | "partner";
      role: "primary" | "partner";
    };

/**
 * One frame's row. Renders a numbered slot, the block-type badge, two
 * player pickers (one for singles, two for doubles/scotch), an inline
 * conflict callout, and the post-submit opponent line. Players already
 * assigned in other slots show up as disabled options labelled with
 * the assigned game number so the captain sees the "why" inline.
 */
function LineupRow({
  row,
  canEdit,
  picks,
  rosterMembers,
  usedBy,
  memberById,
  issues,
  bothSubmitted,
  opponentFor,
  onChangePrimary,
  onChangePartner,
}: {
  row: { frameNumber: number; type: "SINGLES" | "DOUBLES" | "SCOTCH_DOUBLES" };
  canEdit: boolean;
  picks: { primary?: string; partner?: string };
  rosterMembers: RosterMember[];
  usedBy: Map<
    string,
    Array<{
      frameNumber: number;
      role: "primary" | "partner";
      category: "SINGLES" | "DOUBLES";
    }>
  >;
  memberById: Map<string, { id: string; name: string; avatarUrl?: string | null }>;
  issues: LineupRowIssue[];
  bothSubmitted: boolean;
  opponentFor: (frameNumber: number) => string | null;
  onChangePrimary: (value: string | undefined) => void;
  onChangePartner: (value: string | undefined) => void;
}) {
  const blocking = issues.some(
    (i) => i.kind === "duplicate-couple" || i.kind === "duplicate-player",
  );
  return (
    <li
      className={
        "flex flex-col gap-2 rounded-md border bg-background px-3 py-2 " +
        (blocking
          ? "border-destructive/50 bg-destructive/5"
          : picks.primary && (row.type === "SINGLES" || picks.partner)
            ? "border-success/40"
            : "border-border")
      }
      data-testid={`lineup-slot-${row.frameNumber}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span
          aria-hidden
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary/60 text-xs font-bold tabular-nums text-muted-foreground"
        >
          {row.frameNumber}
        </span>
        <Badge variant={row.type === "SINGLES" ? "primary" : "info"} size="sm">
          {row.type === "SINGLES"
            ? "Singles"
            : row.type === "DOUBLES"
              ? "Doubles"
              : "Scotch Doubles"}
        </Badge>
        <div className="ml-auto flex flex-1 flex-wrap items-center justify-end gap-2">
          <PlayerSelect
            value={picks.primary ?? ""}
            disabled={!canEdit}
            placeholder={
              row.type === "SINGLES" ? "Select player" : "Select player 1"
            }
            rosterMembers={rosterMembers}
            usedBy={usedBy}
            rowCategory={row.type === "SINGLES" ? "SINGLES" : "DOUBLES"}
            currentRoleInRow={{ frameNumber: row.frameNumber, role: "primary" }}
            // For the partner picker we also exclude the row's primary so the
            // couple can't be the same player. Here on primary, only exclude
            // the partner if it's been picked.
            blockedPlayerId={picks.partner ?? null}
            onChange={(v) => onChangePrimary(v || undefined)}
            testId={`lineup-primary-${row.frameNumber}`}
          />
          {row.type !== "SINGLES" ? (
            <PlayerSelect
              value={picks.partner ?? ""}
              disabled={!canEdit}
              placeholder="Select player 2"
              rosterMembers={rosterMembers}
              usedBy={usedBy}
              rowCategory="DOUBLES"
              currentRoleInRow={{
                frameNumber: row.frameNumber,
                role: "partner",
              }}
              blockedPlayerId={picks.primary ?? null}
              onChange={(v) => onChangePartner(v || undefined)}
              testId={`lineup-partner-${row.frameNumber}`}
            />
          ) : null}
        </div>
        {bothSubmitted ? (
          <div className="ml-2 hidden text-xs text-muted-foreground md:block">
            <span className="font-semibold">vs </span>
            {opponentFor(row.frameNumber) ?? "—"}
          </div>
        ) : null}
      </div>

      {issues.length > 0 ? (
        <ul className="ml-10 flex flex-wrap gap-1 text-[11px]">
          {issues.map((i, idx) => (
            <li
              key={idx}
              className={
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 " +
                (i.kind === "duplicate-couple" || i.kind === "duplicate-player"
                  ? "bg-destructive/15 text-destructive"
                  : "bg-warning/15 text-warning")
              }
            >
              <AlertCircle className="size-3" />
              {i.kind === "missing-primary"
                ? "Pick a player"
                : i.kind === "missing-partner"
                  ? "Pick a partner"
                  : i.kind === "duplicate-couple"
                    ? "Partner can't be the same player"
                    : `${memberById.get(i.playerId)?.name ?? "Player"} is in game ${i.otherFrame}`}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * Round-50 — shadcn-style player picker for the lineup. Each row in the
 * popup shows the player's avatar + name, with disabled rows greyed out
 * and a short reason ("In game 4", "Already in this couple") so the
 * captain knows why they can't pick again. Built on the shared Select
 * primitive so the focus trap / keyboard navigation come for free.
 */
function PlayerSelect({
  value,
  disabled,
  placeholder,
  rosterMembers,
  usedBy,
  rowCategory,
  currentRoleInRow,
  blockedPlayerId,
  onChange,
  testId,
}: {
  value: string;
  disabled: boolean;
  placeholder: string;
  rosterMembers: RosterMember[];
  usedBy: Map<
    string,
    Array<{
      frameNumber: number;
      role: "primary" | "partner";
      category: "SINGLES" | "DOUBLES";
    }>
  >;
  rowCategory: "SINGLES" | "DOUBLES";
  currentRoleInRow: { frameNumber: number; role: "primary" | "partner" };
  /** A player id that's been picked as the other slot in this same row —
   *  shown as disabled to keep the doubles couple distinct. */
  blockedPlayerId: string | null;
  onChange: (next: string) => void;
  testId: string;
}) {
  const options: SelectOption[] = rosterMembers.map((m) => {
    const uses = usedBy.get(m.user.id) ?? [];
    // Conflict only against the same category: a singles player can still
    // be picked here if the row is doubles, and vice versa.
    const usedElsewhere = uses.find(
      (u) =>
        u.category === rowCategory &&
        !(
          u.frameNumber === currentRoleInRow.frameNumber &&
          u.role === currentRoleInRow.role
        ),
    );
    const isBlockedByCouple = blockedPlayerId === m.user.id;
    const isCurrentlySelected = value === m.user.id;
    const optionDisabled =
      (!!usedElsewhere || isBlockedByCouple) && !isCurrentlySelected;
    const description = isBlockedByCouple
      ? "In this couple"
      : usedElsewhere
        ? `In game ${usedElsewhere.frameNumber}`
        : null;
    return {
      value: m.user.id,
      disabled: optionDisabled,
      description,
      label: (
        <span className="flex items-center gap-2">
          <Avatar
            size="sm"
            src={m.user.avatarUrl ?? undefined}
            fallback={m.user.name}
          />
          <span className="truncate">
            {m.user.name}
            <CountryFlag
              code={m.user.nationality}
              className="ml-1 leading-none"
            />
          </span>
        </span>
      ),
    };
  });

  return (
    <Select
      id={testId}
      value={value}
      onValueChange={onChange}
      options={options}
      placeholder={placeholder}
      disabled={disabled}
      className="h-9 max-w-[240px] flex-1"
    />
  );
}

// Avoid the unused-import warning when the file imports `Avatar`.
void Avatar;
