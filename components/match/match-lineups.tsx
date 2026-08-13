"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { Trophy } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CountryFlag } from "@/components/ui/country-flag";
import { Select, type SelectOption } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  ApproveLineupEditMutation,
  RecordFrameMutation,
  RejectLineupEditMutation,
  RequestLineupEditMutation,
  SubmitLineupMutation,
  CompetitionRosterQuery,
} from "@/lib/graphql/operations/match.operations";
import { WinnerModal } from "./winner-modal";

// ---- Local view types (subset of MatchDetailQuery) ----------------------
type PlayerRef = {
  id: string;
  name: string;
  nationality?: string | null;
  avatarUrl?: string | null;
} | null;

type Frame = {
  id: string;
  frameNumber: number;
  blockType?: string | null;
  blockOrder?: number | null;
  homeWon?: boolean | null;
  isWalkover: boolean;
  breakAndRun: boolean;
  homePlayer?: string | null;
  awayPlayer?: string | null;
  homePlayerRef: PlayerRef;
  awayPlayerRef: PlayerRef;
};

type BlockState = {
  blockOrder: number;
  blockType: string;
  homeSubmittedAt?: string | null;
  awaySubmittedAt?: string | null;
  published: boolean;
  fullyDecided: boolean;
  isCurrentActive: boolean;
};

export type MatchLineupsData = {
  id: string;
  status: string;
  homeTeam?: { id: string; name: string; captain?: { id: string } | null } | null;
  awayTeam?: { id: string; name: string; captain?: { id: string } | null } | null;
  frames: Frame[];
  blockStates: BlockState[];
  lineupEditRequestedById?: string | null;
  lineupEditRequestedAt?: string | null;
  lineupEditRequestedBlockOrder?: number | null;
  matchday: {
    competition: {
      id: string;
      breakAndRunRule: boolean;
      organizer?: { id: string } | null;
      blocks: Array<{
        id: string;
        order: number;
        type: string;
        games: number;
        breakAfterMin?: number | null;
      }>;
    };
  };
};

const BLOCK_LABEL: Record<string, string> = {
  SINGLES: "Singles",
  DOUBLES: "Doubles",
  SCOTCH_DOUBLES: "Scotch",
};

function isDoubles(type?: string | null) {
  return type === "DOUBLES" || type === "SCOTCH_DOUBLES";
}

// Singles → the linked player's name; doubles → the composed "A & B"
// free-text label written at lineup submission.
function frameSideLabel(frame: Frame, which: "home" | "away"): string | null {
  const ref = which === "home" ? frame.homePlayerRef : frame.awayPlayerRef;
  const free = which === "home" ? frame.homePlayer : frame.awayPlayer;
  if (isDoubles(frame.blockType)) return free ?? ref?.name ?? null;
  return ref?.name ?? free ?? null;
}

// The side's players as separate names — one for singles, both couple members
// for doubles (the "A & B" free-text label split back apart) so they can be
// rendered stacked.
function sideNames(frame: Frame, which: "home" | "away"): string[] {
  const label = frameSideLabel(frame, which);
  if (!label) return [which === "home" ? "Home" : "Away"];
  if (isDoubles(frame.blockType)) {
    return label
      .split(" & ")
      .map((n) => n.trim())
      .filter(Boolean);
  }
  return [label];
}

export function MatchLineups({
  match,
  viewerId,
  viewerRole,
  onChanged,
}: {
  match: MatchLineupsData;
  viewerId: string | null;
  viewerRole: string | null;
  onChanged: () => Promise<unknown> | void;
}) {
  const toast = useToast();
  const completed = match.status === "COMPLETED";

  const captainSide: "home" | "away" | null =
    viewerId && match.homeTeam?.captain?.id === viewerId
      ? "home"
      : viewerId && match.awayTeam?.captain?.id === viewerId
        ? "away"
        : null;
  const isCaptain = captainSide !== null;
  // Round-64 — "staff" = this competition's organizer or a SUPER_ADMIN. They
  // can enter lineups/results on behalf of the teams. (A global ORGANIZER role
  // only grants powers on competitions they actually own — mirror the server,
  // which authorizes off competition.organizerId, so we don't render controls
  // the server would reject.)
  const isThisOrganizer =
    !!viewerId && match.matchday.competition.organizer?.id === viewerId;
  const isStaff = viewerRole === "SUPER_ADMIN" || isThisOrganizer;
  // Which team a non-captain staff member is currently entering a lineup for.
  const [staffSide, setStaffSide] = useState<"home" | "away" | null>(null);
  // Effective side: a captain's own side, else the side staff picked.
  const side: "home" | "away" | null =
    captainSide ?? (isStaff ? staffSide : null);
  // Can the viewer edit/submit a lineup right now (captain, or staff with a
  // side selected)?
  const canManageLineup = isCaptain || (isStaff && side !== null);
  const canPickWinner = (isCaptain || isStaff) && !completed;

  const ourTeamId =
    side === "home" ? match.homeTeam?.id : side === "away" ? match.awayTeam?.id : undefined;
  // Lineup selection is limited to the roster the team locked in when applying
  // to this competition — not the full team membership.
  const { data: rosterData } = useQuery(CompetitionRosterQuery, {
    variables: {
      competitionId: match.matchday.competition.id,
      teamId: ourTeamId ?? "",
    },
    skip: !ourTeamId,
  });
  const roster = useMemo(
    () => rosterData?.competitionRoster ?? [],
    [rosterData],
  );

  const [submitLineup, { loading: submitting }] = useMutation(SubmitLineupMutation);
  const [recordFrame] = useMutation(RecordFrameMutation);
  const [requestEdit] = useMutation(RequestLineupEditMutation);
  const [approveEdit] = useMutation(ApproveLineupEditMutation);
  const [rejectEdit] = useMutation(RejectLineupEditMutation);

  // Which block the captain is actively editing (re-edit after submit).
  const [editingBlock, setEditingBlock] = useState<number | null>(null);
  // picks[frameNumber] = { primary, partner? }
  const [picks, setPicks] = useState<Record<number, { primary?: string; partner?: string }>>({});
  // Winner modal target frame.
  const [winnerFrame, setWinnerFrame] = useState<Frame | null>(null);

  const blocks = useMemo(
    () => [...match.matchday.competition.blocks].sort((a, b) => a.order - b.order),
    [match.matchday.competition.blocks],
  );
  const framesByBlock = useMemo(() => {
    // Frames are scaffolded server-side only on the FIRST lineup submit, so a
    // brand-new match has none yet. Lay out the expected frames from the block
    // structure (order + games) and drop in any real frame that already
    // exists — this keeps the Select-Player editor rows on screen by default
    // instead of showing a bare "Submit Lineup" button that would submit an
    // empty lineup.
    const realByNumber = new Map(match.frames.map((f) => [f.frameNumber, f]));
    const map = new Map<number, Frame[]>();
    let n = 0;
    for (const b of blocks) {
      const arr: Frame[] = [];
      for (let i = 0; i < b.games; i++) {
        n += 1;
        const real = realByNumber.get(n);
        arr.push(
          real ?? {
            id: `pending-${n}`,
            frameNumber: n,
            blockType: b.type,
            blockOrder: b.order,
            homeWon: null,
            isWalkover: false,
            breakAndRun: false,
            homePlayer: null,
            awayPlayer: null,
            homePlayerRef: null,
            awayPlayerRef: null,
          },
        );
      }
      map.set(b.order, arr);
    }
    return map;
  }, [match.frames, blocks]);
  const blockStateByOrder = useMemo(() => {
    const map = new Map<number, BlockState>();
    for (const bs of match.blockStates) map.set(bs.blockOrder, bs);
    return map;
  }, [match.blockStates]);

  const firstOrder = blocks[0]?.order;

  // ---- helpers ----------------------------------------------------------
  // Seed the editor from a side's existing lineup (fully replacing prior
  // picks, so a side switch doesn't bleed the other team's selections).
  function seedPicks(frames: Frame[], forSide: "home" | "away" | null = side) {
    const next: Record<number, { primary?: string; partner?: string }> = {};
    for (const f of frames) {
      const ref = forSide === "home" ? f.homePlayerRef : f.awayPlayerRef;
      if (ref) next[f.frameNumber] = { primary: ref.id };
    }
    setPicks(next);
  }

  async function onSubmitBlock(blockOrder: number, frames: Frame[]) {
    // Staff must have a team selected (the editor gate already guarantees this;
    // this is a defensive backstop so a null side never posts as "AWAY").
    if (!isCaptain && !side) {
      toast.error("Pick a team first", "Choose which team's lineup to enter.");
      return;
    }
    const slots: Array<{ frameNumber: number; playerId: string; partnerPlayerId?: string }> = [];
    for (const f of frames) {
      const pick = picks[f.frameNumber];
      if (!pick?.primary) {
        toast.error("Pick every player", "Each game in this block needs a player.");
        return;
      }
      if (isDoubles(f.blockType) && !pick.partner) {
        toast.error("Pick both partners", "Doubles games need two players.");
        return;
      }
      slots.push({
        frameNumber: f.frameNumber,
        playerId: pick.primary,
        partnerPlayerId: isDoubles(f.blockType) ? pick.partner : undefined,
      });
    }
    try {
      await submitLineup({
        variables: {
          input: {
            matchId: match.id,
            blockOrder,
            slots,
            // Captains omit side (server derives it); staff acting on behalf
            // of a team must say which one.
            ...(isCaptain ? {} : { side: side === "home" ? "HOME" : "AWAY" }),
          },
        },
      });
      setEditingBlock(null);
      toast.success("Lineup submitted");
      await onChanged();
    } catch (e) {
      toast.error("Could not submit lineup", e instanceof Error ? e.message : "Try again.");
    }
  }

  async function onConfirmWinner(frame: Frame, winner: "home" | "away", br: boolean) {
    try {
      // Round-63 — B&R is sticky server-side (it only ever ORs on). Turning a
      // frame that already had B&R *off* is the one deliberate case that must
      // clear it, so flag that intent explicitly. A blind write (br=false on a
      // frame that never showed B&R to this captain) leaves any existing flag
      // intact.
      const clearBreakAndRun = frame.breakAndRun === true && br === false;
      await recordFrame({
        variables: {
          input: {
            matchId: match.id,
            frameNumber: frame.frameNumber,
            homeWon: winner === "home",
            homePlayer: frame.homePlayer ?? null,
            awayPlayer: frame.awayPlayer ?? null,
            breakAndRun: br,
            clearBreakAndRun,
          },
        },
      });
      await onChanged();
    } catch (e) {
      toast.error("Could not save result", e instanceof Error ? e.message : "Try again.");
    }
  }

  async function onRequestEdit(blockOrder: number) {
    try {
      await requestEdit({ variables: { matchId: match.id, blockOrder } });
      toast.success("Edit requested", "Waiting for the opponent to approve.");
      await onChanged();
    } catch (e) {
      toast.error("Could not request edit", e instanceof Error ? e.message : "Try again.");
    }
  }
  async function onApprove() {
    try {
      await approveEdit({ variables: { matchId: match.id } });
      await onChanged();
    } catch (e) {
      toast.error("Could not approve", e instanceof Error ? e.message : "Try again.");
    }
  }
  async function onReject() {
    try {
      await rejectEdit({ variables: { matchId: match.id } });
      await onChanged();
    } catch (e) {
      toast.error("Could not reject", e instanceof Error ? e.message : "Try again.");
    }
  }

  // Roster options for a slot. Captains can assign any player to any games —
  // no cross-frame limits. The only thing we disable is picking the same
  // person as both members of the SAME doubles couple.
  function optionsFor(
    _blockType: string,
    frameNumber: number,
    which: "primary" | "partner",
  ): SelectOption[] {
    const used = new Set<string>();
    const pick = picks[frameNumber];
    if (pick) {
      if (which === "primary" && pick.partner) used.add(pick.partner);
      if (which === "partner" && pick.primary) used.add(pick.primary);
    }
    return roster.map((u) => ({
      value: u.id,
      label: (
        <span className="inline-flex items-center gap-1.5">
          {u.name}
          <CountryFlag code={u.nationality} className="leading-none" />
        </span>
      ),
      disabled: used.has(u.id),
    }));
  }

  if (blocks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This match has no game structure configured.
      </p>
    );
  }

  return (
    <div className="space-y-2" data-testid="match-lineups">
      <div className="text-center">
        <h3 className="text-base font-semibold text-white/90">Match Lineups</h3>
        {!completed ? (
          <p className="text-xs text-muted-foreground">
            {isStaff && !isCaptain
              ? "As organizer you can enter each team's lineup and results below."
              : isCaptain
                ? "Submit your lineup for each block; pick winners once both captains submit."
                : "Lineups are hidden until both team captains submit."}
          </p>
        ) : null}
      </div>

      {blocks.map((block, bi) => {
        const frames = framesByBlock.get(block.order) ?? [];
        const bs = blockStateByOrder.get(block.order);
        const published = bs?.published ?? false;
        const fullyDecided = bs?.fullyDecided ?? false;
        const isCurrent = bs?.isCurrentActive ?? false;
        const mySubmitted =
          side === "home" ? !!bs?.homeSubmittedAt : side === "away" ? !!bs?.awaySubmittedAt : false;

        // Future block not yet reachable.
        const future = !isCurrent && !published && !fullyDecided;

        // Round-66 — staff may re-open a block to fix a lineup error at any
        // point before it's fully decided (the server allows staff to override
        // an already-locked block). `staffEditingThis` = they've opened it.
        // Round-70 — staff may edit a block's lineup any time the match isn't
        // completed, including after all its games are decided (e.g. an
        // organizer fixing a lineup mistake on a re-opened match).
        const staffCanEdit = isStaff && !isCaptain && !completed;
        const staffEditingThis = staffCanEdit && editingBlock === block.order;

        // Round-64 — staff pick which team they're entering THIS block's lineup
        // for, shown in-context right above the editor. Shows on the block
        // awaiting lineups, or on any block a staff member re-opened to edit —
        // so it's never a detached toggle floating up top once games start.
        const showStaffSelector =
          (isStaff && !isCaptain && !completed && isCurrent && !published) ||
          staffEditingThis;

        const editing =
          (canManageLineup && isCurrent && !published && (!mySubmitted || editingBlock === block.order)) ||
          (staffEditingThis && side !== null);
        const waiting = canManageLineup && isCurrent && !published && mySubmitted && editingBlock !== block.order;

        const editReqForThis =
          match.lineupEditRequestedAt != null &&
          match.lineupEditRequestedBlockOrder === block.order;
        const iRequested = editReqForThis && match.lineupEditRequestedById === viewerId;
        const iCanRespond = editReqForThis && isCaptain && match.lineupEditRequestedById !== viewerId;

        const showNextHeading = editing && firstOrder != null && block.order > firstOrder;

        return (
          <div key={block.id}>
            {showNextHeading ? (
              <p className="py-2 text-center text-sm font-semibold text-white/90">
                Submit Lineups for Next Games
              </p>
            ) : null}

            {/* Round-64 — in-context team picker for staff, sitting right on
                top of the lineup editor it drives. */}
            {showStaffSelector ? (
              <div className="mb-2 flex flex-wrap items-center justify-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2">
                <span className="text-xs text-muted-foreground">
                  Enter lineup as:
                </span>
                {(["home", "away"] as const).map((s) => {
                  const name =
                    s === "home" ? match.homeTeam?.name : match.awayTeam?.name;
                  const active = staffSide === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setStaffSide(s);
                        // Seed the editor from this side's current lineup so
                        // staff edit from the existing state (fixing errors)
                        // rather than a blank form; frame numbers are shared
                        // across teams, so this also replaces any picks bled in
                        // from the other side.
                        seedPicks(frames, s);
                      }}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                        active
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border text-white/80 hover:border-primary/50"
                      }`}
                      data-testid={`staff-side-${s}`}
                    >
                      {name ?? (s === "home" ? "Home" : "Away")}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/* First-block starter banner (Figma screen 1). */}
            {editing && firstOrder != null && block.order === firstOrder ? (
              <div className="mb-2 rounded-lg border border-[#00598a] bg-[#052f4a] px-3 py-2 text-center text-sm text-[#dff2fe]">
                To start the match submit lineups.
                <br />
                Lineups are hidden until both team captains submit their lineups.
              </div>
            ) : null}

            {showStaffSelector && !staffSide ? (
              <p className="py-3 text-center text-xs text-muted-foreground">
                Pick a team above to enter its lineup.
              </p>
            ) : (
            <div className={`space-y-2 ${future ? "opacity-50" : ""}`}>
              {frames.map((f) => {
                // Captain editing the current block (or its disabled preview
                // for a not-yet-reachable future block).
                if (editing || (future && canManageLineup)) {
                  return (
                    <LineupEditorRow
                      key={f.id}
                      frame={f}
                      disabled={!editing}
                      pick={picks[f.frameNumber] ?? {}}
                      onPrimary={(v) =>
                        setPicks((p) => ({ ...p, [f.frameNumber]: { ...p[f.frameNumber], primary: v } }))
                      }
                      onPartner={(v) =>
                        setPicks((p) => ({ ...p, [f.frameNumber]: { ...p[f.frameNumber], partner: v } }))
                      }
                      options={(which) => optionsFor(f.blockType ?? "SINGLES", f.frameNumber, which)}
                    />
                  );
                }
                const homeKnown = published || (waiting && side === "home");
                const awayKnown = published || (waiting && side === "away");
                return (
                  <GameCard
                    key={f.id}
                    frame={f}
                    homeKnown={homeKnown}
                    awayKnown={awayKnown}
                    homeName={match.homeTeam?.name ?? "Home"}
                    awayName={match.awayTeam?.name ?? "Away"}
                    clickable={published && canPickWinner}
                    onClick={() => setWinnerFrame(f)}
                  />
                );
              })}
            </div>
            )}

            {/* Per-block controls */}
            <div className="flex flex-col items-center gap-1 py-2">
              {editing ? (
                <div className="flex items-center gap-2">
                  {staffEditingThis ? (
                    <Button
                      variant="ghost"
                      onClick={() => setEditingBlock(null)}
                    >
                      Cancel
                    </Button>
                  ) : null}
                  <Button variant="primary" loading={submitting} onClick={() => onSubmitBlock(block.order, frames)}>
                    Submit Lineup
                  </Button>
                </div>
              ) : null}

              {waiting ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      seedPicks(frames);
                      setEditingBlock(block.order);
                    }}
                  >
                    Edit
                  </Button>
                </>
              ) : null}

              {published && (!fullyDecided || isStaff) && (isCaptain || isStaff) && !staffEditingThis ? (
                <div className="flex flex-col items-center gap-1">
                  {!completed && !fullyDecided ? (
                    <p className="text-center text-sm font-semibold text-[#00bba7]">
                      Lineup published. Click a game card to select winners.
                    </p>
                  ) : null}
                  {/* Round-66 — staff can re-open a published lineup to fix an
                      error (server allows the override). */}
                  {staffCanEdit ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingBlock(block.order);
                        if (staffSide) seedPicks(frames, staffSide);
                      }}
                      data-testid={`staff-edit-lineup-${block.order}`}
                    >
                      Edit lineup
                    </Button>
                  ) : null}
                  {/* Edit-request flow is captain-to-captain; staff don't use it. */}
                  {isCaptain && iCanRespond ? (
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-sm font-semibold text-[#00bba7]">Opponent Requested Edit</p>
                      <p className="text-xs text-muted-foreground">
                        You will be able to edit your lineup as well.
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={onApprove}>
                          Approve
                        </Button>
                        <Button variant="danger" onClick={onReject}>
                          Reject
                        </Button>
                      </div>
                    </div>
                  ) : isCaptain && iRequested ? (
                    <p className="text-xs text-muted-foreground">
                      Edit request sent — waiting for the opponent to approve.
                    </p>
                  ) : isCaptain && !completed ? (
                    <Button variant="outline" onClick={() => onRequestEdit(block.order)}>
                      Request Edit
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>

            {block.breakAfterMin && block.breakAfterMin > 0 && bi < blocks.length - 1 ? (
              <div
                data-testid="match-lineup-break"
                className="my-2 flex items-center justify-center gap-2 rounded-lg bg-secondary/40 py-3 text-xs text-muted-foreground"
              >
                <Trophy className="size-3" />
                Break Time for Next Lineup · {block.breakAfterMin} min
              </div>
            ) : null}
          </div>
        );
      })}

      {winnerFrame ? (
        <WinnerModal
          open={!!winnerFrame}
          onClose={() => setWinnerFrame(null)}
          home={{
            label: frameSideLabel(winnerFrame, "home") ?? "Home",
            names: sideNames(winnerFrame, "home"),
            avatarUrl: winnerFrame.homePlayerRef?.avatarUrl,
            nationality: winnerFrame.homePlayerRef?.nationality,
          }}
          away={{
            label: frameSideLabel(winnerFrame, "away") ?? "Away",
            names: sideNames(winnerFrame, "away"),
            avatarUrl: winnerFrame.awayPlayerRef?.avatarUrl,
            nationality: winnerFrame.awayPlayerRef?.nationality,
          }}
          initialWinner={
            winnerFrame.homeWon === true ? "home" : winnerFrame.homeWon === false ? "away" : null
          }
          initialBreakAndRun={winnerFrame.breakAndRun}
          onConfirm={(winner, br) => onConfirmWinner(winnerFrame, winner, br)}
        />
      ) : null}
    </div>
  );
}

// ---- Editor row (Select Player dropdowns) -------------------------------
function LineupEditorRow({
  frame,
  pick,
  disabled,
  onPrimary,
  onPartner,
  options,
}: {
  frame: Frame;
  pick: { primary?: string; partner?: string };
  disabled?: boolean;
  onPrimary: (v: string) => void;
  onPartner: (v: string) => void;
  options: (which: "primary" | "partner") => SelectOption[];
}) {
  const doubles = isDoubles(frame.blockType);
  const tone = doubles ? "border-purple-500/30 bg-purple-500/5" : "border-border bg-secondary/20";
  return (
    <div
      data-testid={`lineup-slot-${frame.frameNumber}`}
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${tone}`}
    >
      <span className="w-4 text-right text-xs text-muted-foreground">{frame.frameNumber}</span>
      <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">
        {BLOCK_LABEL[frame.blockType ?? "SINGLES"] ?? "Game"}
      </span>
      <div className={`flex flex-1 gap-2 ${doubles ? "flex-col sm:flex-row" : ""}`}>
        <Select
          value={pick.primary}
          onValueChange={onPrimary}
          options={options("primary")}
          placeholder={doubles ? "Select Player 1" : "Select Player"}
          disabled={disabled}
          className="flex-1"
        />
        {doubles ? (
          <Select
            value={pick.partner}
            onValueChange={onPartner}
            options={options("partner")}
            placeholder="Select Player 2"
            disabled={disabled}
            className="flex-1"
          />
        ) : null}
      </div>
    </div>
  );
}

// ---- Game card (played / waiting / published) ---------------------------
function GameCard({
  frame,
  homeKnown,
  awayKnown,
  homeName,
  awayName,
  clickable,
  onClick,
}: {
  frame: Frame;
  homeKnown: boolean;
  awayKnown: boolean;
  homeName: string;
  awayName: string;
  clickable: boolean;
  onClick: () => void;
}) {
  // Neither side revealed yet → the "hidden until both submit" placeholder.
  if (!homeKnown && !awayKnown) {
    return (
      <div
        data-testid={`lineup-slot-${frame.frameNumber}`}
        className="flex items-center gap-3 rounded-lg border border-border bg-secondary/20 px-3 py-3"
      >
        <span className="w-4 text-right text-xs text-muted-foreground">{frame.frameNumber}</span>
        <span className="flex-1 text-center text-sm text-muted-foreground">
          Hidden until both captains submit
        </span>
      </div>
    );
  }
  const decided = frame.homeWon != null;
  const Wrapper: React.ElementType = clickable ? "button" : "div";
  return (
    <Wrapper
      {...(clickable ? { type: "button", onClick } : {})}
      data-testid={`lineup-slot-${frame.frameNumber}`}
      className={`flex w-full items-stretch overflow-hidden rounded-lg border border-border text-left ${
        clickable ? "cursor-pointer transition-colors hover:border-primary/50" : ""
      }`}
    >
      {homeKnown ? (
        <GameSide
          label={frameSideLabel(frame, "home")}
          names={sideNames(frame, "home")}
          ref_={frame.homePlayerRef}
          teamName={homeName}
          won={frame.homeWon === true}
          lost={decided && frame.homeWon === false}
        />
      ) : (
        <WaitingSide />
      )}
      <div className="flex w-10 shrink-0 flex-col items-center justify-center gap-0.5 bg-secondary/30 text-[10px] font-semibold text-muted-foreground">
        <span>{frame.frameNumber}</span>
        <span>VS</span>
        {frame.breakAndRun ? (
          <span className="rounded bg-primary/20 px-1 text-[8px] font-bold text-primary">B&amp;R</span>
        ) : null}
      </div>
      {awayKnown ? (
        <GameSide
          label={frameSideLabel(frame, "away")}
          names={sideNames(frame, "away")}
          ref_={frame.awayPlayerRef}
          teamName={awayName}
          won={frame.homeWon === false}
          lost={decided && frame.homeWon === true}
          align="right"
        />
      ) : (
        <WaitingSide />
      )}
    </Wrapper>
  );
}

function GameSide({
  label,
  names,
  ref_,
  won,
  lost,
  teamName,
  align = "left",
}: {
  label: string | null;
  names: string[];
  ref_: PlayerRef;
  won: boolean;
  lost: boolean;
  teamName: string;
  align?: "left" | "right";
}) {
  const tone = won ? "bg-[#005f5a]/30" : lost ? "bg-[#861043]/25" : "bg-transparent";
  const lines = names.length ? names : [label ?? "TBD"];
  const single = lines.length === 1;
  return (
    <div
      className={`relative flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 ${tone} ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      {/* Avatars are dropped on mobile so two names + the VS column fit a
          narrow row without overflowing. */}
      <Avatar
        size="sm"
        src={ref_?.avatarUrl ?? undefined}
        fallback={label ?? teamName}
        className="hidden size-7 shrink-0 sm:inline-flex"
      />
      <span
        className={`flex min-w-0 flex-1 flex-col gap-0.5 text-sm leading-snug text-white/90 ${
          align === "right" ? "items-end" : "items-start"
        } ${won ? (align === "right" ? "sm:pl-12" : "sm:pr-12") : ""}`}
      >
        {lines.map((n, i) => (
          <span key={i} className="flex min-w-0 max-w-full items-center gap-1">
            {/* Truncate rather than wrap so a long name can't blow up the row
                height / width. */}
            <span className="min-w-0 truncate">{n}</span>
            {single && ref_?.nationality ? (
              <CountryFlag code={ref_.nationality} className="shrink-0 leading-none" />
            ) : null}
          </span>
        ))}
      </span>
      {/* Winner pill is absolutely positioned in the outer top corner so it
          never widens the row; the teal tint already flags the winner. */}
      {/* On mobile the teal tint alone flags the winner (keeps the row tight);
          the "Winner" pill returns on ≥ sm where there's room. */}
      {won ? (
        <span
          className={`pointer-events-none absolute top-1 hidden rounded bg-[#005f5a] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#96f7e4] sm:block ${
            align === "right" ? "left-1" : "right-1"
          }`}
        >
          Winner
        </span>
      ) : null}
    </div>
  );
}

function WaitingSide() {
  return (
    <div className="flex flex-1 items-center justify-center px-3 py-3 text-sm text-muted-foreground">
      Waiting for opponent
    </div>
  );
}
