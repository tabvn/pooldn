"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  CalendarClock,
  Flag,
  RotateCcw,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { useToast } from "@/components/ui/toast";
import {
  ForfeitMatchMutation,
  MatchRescheduleRequestsQuery,
  ReopenMatchMutation,
  RequestMatchRescheduleMutation,
  ReviewRescheduleRequestMutation,
  UpdateMatchScheduleMutation,
} from "@/lib/graphql/operations/match.operations";

type Team = {
  id: string;
  name: string;
} | null | undefined;

/**
 * Round-20 — captain + organizer actions surfaced on the match-flow page.
 *
 *  - Organizer can: mark forfeit (pick the no-show side or both), reschedule
 *    (date + optional venue), and approve/reject pending reschedule requests.
 *  - Captains can: request a reschedule (organizer reviews).
 *
 * All mutations toast + refresh the page (and the parent match query) so the
 * status chip, schedule timestamp and reschedule list update in place.
 */
export function MatchAdminActions({
  matchId,
  isOrganizer,
  isCaptain,
  homeTeam,
  awayTeam,
  status,
  competitionStatus,
  scheduledAt,
  onMutated,
}: {
  matchId: string;
  isOrganizer: boolean;
  isCaptain: boolean;
  homeTeam: Team;
  awayTeam: Team;
  status: string;
  competitionStatus?: string | null;
  scheduledAt: string | null;
  onMutated: () => void | Promise<void>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [forfeit, forfeitState] = useMutation(ForfeitMatchMutation);
  const [reopen, reopenState] = useMutation(ReopenMatchMutation);
  const [updateSchedule, schedState] = useMutation(UpdateMatchScheduleMutation);
  const [requestResched, reqState] = useMutation(RequestMatchRescheduleMutation);
  const [reviewResched, reviewState] = useMutation(ReviewRescheduleRequestMutation);
  const reqsQuery = useQuery(MatchRescheduleRequestsQuery, {
    variables: { matchId },
    fetchPolicy: "cache-and-network",
  });
  const requests = reqsQuery.data?.match?.rescheduleRequests ?? [];
  const pendingRequests = requests.filter((r) => r.status === "PENDING");

  const [forfeitOpen, setForfeitOpen] = useState(false);
  const [forfeitSide, setForfeitSide] = useState<"home" | "away" | "both">(
    "home",
  );
  const [forfeitReason, setForfeitReason] = useState("");

  const [reschedOpen, setReschedOpen] = useState(false);
  const [reschedDate, setReschedDate] = useState("");
  const [reschedReason, setReschedReason] = useState("");

  const completed = status === "COMPLETED";

  async function refresh() {
    await Promise.all([reqsQuery.refetch(), Promise.resolve(onMutated())]);
    router.refresh();
  }

  async function onReopen() {
    try {
      await reopen({ variables: { matchId } });
      toast.success(
        "Match reopened",
        "Fix the lineups or results, then confirm again.",
      );
      await refresh();
    } catch (e) {
      toast.error(
        "Could not reopen match",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  async function onForfeit() {
    const both = forfeitSide === "both";
    const forfeitingTeamId =
      forfeitSide === "away" ? awayTeam?.id : homeTeam?.id;
    if (!forfeitingTeamId) return;
    try {
      await forfeit({
        variables: {
          matchId,
          forfeitingTeamId,
          bothForfeit: both,
          reason: forfeitReason || null,
        },
      });
      toast.success(both ? "Double forfeit recorded" : "Match awarded by walkover");
      setForfeitOpen(false);
      await refresh();
    } catch (e) {
      toast.error(
        "Could not forfeit",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  async function onReschedule() {
    if (!reschedDate) {
      toast.error("Pick a date", "Choose a new date / time for the match.");
      return;
    }
    try {
      await updateSchedule({
        variables: {
          id: matchId,
          scheduledAt: new Date(reschedDate).toISOString(),
        },
      });
      toast.success("Match rescheduled");
      setReschedOpen(false);
      await refresh();
    } catch (e) {
      toast.error(
        "Could not reschedule",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  async function onRequestReschedule() {
    if (!reschedDate) {
      toast.error("Pick a date", "Propose a new date / time.");
      return;
    }
    try {
      await requestResched({
        variables: {
          matchId,
          proposedDate: new Date(reschedDate).toISOString(),
          reason: reschedReason || null,
        },
      });
      toast.success("Reschedule request sent");
      setReschedOpen(false);
      setReschedReason("");
      await refresh();
    } catch (e) {
      toast.error(
        "Could not request",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  async function onReviewReq(id: string, approve: boolean) {
    try {
      await reviewResched({ variables: { id, approve } });
      toast.success(approve ? "Reschedule approved" : "Reschedule rejected");
      await refresh();
    } catch (e) {
      toast.error(
        "Could not review",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  if (!isOrganizer && !isCaptain) return null;

  return (
    <Card data-testid="match-admin-actions">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Match controls</CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {scheduledAt ? (
              <span>
                Scheduled <LocalDateTime value={scheduledAt} />
              </span>
            ) : (
              <span>No date set</span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Organizer-only buttons */}
        {isOrganizer && !completed ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              iconBefore={<Flag className="size-4" />}
              onClick={() => setForfeitOpen((v) => !v)}
              data-testid="open-forfeit"
            >
              Mark forfeit
            </Button>
            <Button
              size="sm"
              variant="outline"
              iconBefore={<CalendarClock className="size-4" />}
              onClick={() => setReschedOpen((v) => !v)}
              data-testid="open-reschedule"
            >
              Reschedule
            </Button>
          </div>
        ) : null}

        {/* Round-70 — reopen a completed match to fix a mistake (organizer/
            admin, only while the competition is still ongoing). */}
        {isOrganizer && completed && competitionStatus === "ONGOING" ? (
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                loading={reopenState.loading}
                iconBefore={<RotateCcw className="size-4" />}
                onClick={onReopen}
                data-testid="reopen-match"
              >
                Reopen match
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Puts the match back in progress so you can correct the lineups or
              result, then confirm again.
            </p>
          </div>
        ) : null}

        {/* Captain-only request button */}
        {isCaptain && !isOrganizer && !completed ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              iconBefore={<Send className="size-4" />}
              onClick={() => setReschedOpen((v) => !v)}
              data-testid="open-request-reschedule"
            >
              Request reschedule
            </Button>
          </div>
        ) : null}

        {/* Inline Forfeit form */}
        {forfeitOpen && isOrganizer ? (
          <div
            className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-3 space-y-2"
            data-testid="forfeit-form"
          >
            <Label>Who didn't show up?</Label>
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  checked={forfeitSide === "home"}
                  onChange={() => setForfeitSide("home")}
                />
                {homeTeam?.name ?? "Home"}
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  checked={forfeitSide === "away"}
                  onChange={() => setForfeitSide("away")}
                />
                {awayTeam?.name ?? "Away"}
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  checked={forfeitSide === "both"}
                  onChange={() => setForfeitSide("both")}
                />
                Both (double forfeit)
              </label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="forfeitReason">Reason (optional)</Label>
              <Input
                id="forfeitReason"
                placeholder="No-show, weather, …"
                value={forfeitReason}
                onChange={(e) => setForfeitReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setForfeitOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                loading={forfeitState.loading}
                onClick={onForfeit}
              >
                Confirm forfeit
              </Button>
            </div>
          </div>
        ) : null}

        {/* Inline Reschedule form */}
        {reschedOpen ? (
          <div
            className="rounded-md border border-primary/40 bg-primary/5 px-3 py-3 space-y-2"
            data-testid="reschedule-form"
          >
            <div className="space-y-1.5">
              <Label htmlFor="reschedDate">
                {isOrganizer ? "New date / time" : "Proposed date / time"}
              </Label>
              <Input
                id="reschedDate"
                type="datetime-local"
                value={reschedDate}
                onChange={(e) => setReschedDate(e.target.value)}
              />
            </div>
            {!isOrganizer ? (
              <div className="space-y-1.5">
                <Label htmlFor="reschedReason">Reason (optional)</Label>
                <Input
                  id="reschedReason"
                  placeholder="Why do you need to move it?"
                  value={reschedReason}
                  onChange={(e) => setReschedReason(e.target.value)}
                />
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setReschedOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                loading={schedState.loading || reqState.loading}
                onClick={isOrganizer ? onReschedule : onRequestReschedule}
              >
                {isOrganizer ? "Save new date" : "Send request"}
              </Button>
            </div>
          </div>
        ) : null}

        {/* Pending reschedule requests (organizer reviews) */}
        {isOrganizer && pendingRequests.length > 0 ? (
          <div className="space-y-2">
            <Label>Pending reschedule requests</Label>
            <ul className="space-y-2">
              {pendingRequests.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
                  data-testid={`reschedule-request-${r.id}`}
                >
                  <div>
                    <div className="font-semibold">
                      {r.requestedBy.name} proposes{" "}
                      <LocalDateTime value={r.proposedDate} />
                    </div>
                    {r.reason ? (
                      <div className="text-xs text-muted-foreground italic">
                        "{r.reason}"
                      </div>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      loading={reviewState.loading}
                      onClick={() => onReviewReq(r.id, true)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onReviewReq(r.id, false)}
                    >
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Completed-state recap chips */}
        {completed ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="success" size="sm">
              Final
            </Badge>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
