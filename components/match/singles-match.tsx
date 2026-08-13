"use client";

import { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CountryFlag } from "@/components/ui/country-flag";
import { useToast } from "@/components/ui/toast";
import { RecordFrameMutation } from "@/lib/graphql/operations/match.operations";

type Player = {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string | null;
  nationality?: string | null;
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

/**
 * Round-68 — 1v1 Singles match. No lineups: the two players record frame
 * winners (race-to-N) and the match auto-completes server-side once someone
 * reaches the target.
 */
export function SinglesMatch({
  match,
  viewerId,
  viewerRole,
  organizerId,
  onChanged,
}: {
  match: SinglesMatchData;
  viewerId: string | null;
  viewerRole: string | null;
  organizerId: string | null;
  onChanged: () => Promise<unknown> | void;
}) {
  const toast = useToast();
  const [recordFrame, { loading }] = useMutation(RecordFrameMutation);
  const [br, setBr] = useState(false);

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
  const canPlay =
    !completed && (isPlayer || isStaff) && !!match.homePlayer && !!match.awayPlayer;

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
      toast.error("Could not record frame", e instanceof Error ? e.message : "Try again.");
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
                      <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
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
