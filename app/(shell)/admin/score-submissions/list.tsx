"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CompetitionAutocomplete } from "@/components/competition/competition-autocomplete";
import { PageTitle } from "@/components/layout/page-title";
import { useToast } from "@/components/ui/toast";
import type { ResultOf } from "@graphql-typed-document-node/core";
import {
  MatchScoreSubmissionsListQuery,
  ReviewMatchScoreMutation,
} from "@/lib/graphql/operations/score-submission.operations";

type Submission = NonNullable<
  ResultOf<typeof MatchScoreSubmissionsListQuery>["matchScoreSubmissions"]
>[number];

export function SubmissionsList() {
  const toast = useToast();
  const { data, loading, refetch } = useQuery(MatchScoreSubmissionsListQuery);
  const [review, { loading: reviewing }] = useMutation(ReviewMatchScoreMutation);
  const [resolveFor, setResolveFor] = useState<string | null>(null);
  const [scoreHome, setScoreHome] = useState<number>(0);
  const [scoreAway, setScoreAway] = useState<number>(0);
  const [competitionFilter, setCompetitionFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const submissions = (data?.matchScoreSubmissions ?? []) as Submission[];

  const filtered = submissions.filter((s) => {
    if (
      competitionFilter &&
      s.match.matchday.competition.id !== competitionFilter
    )
      return false;
    if (statusFilter && s.status !== statusFilter) return false;
    return true;
  });

  // Group by match id for compact display.
  const byMatch = new Map<string, Submission[]>();
  for (const s of filtered) {
    const arr = byMatch.get(s.match.id) ?? [];
    arr.push(s);
    byMatch.set(s.match.id, arr);
  }
  const matches = Array.from(byMatch.entries());
  const conflictCount = submissions.filter((s) => s.status === "CONFLICT")
    .length;

  async function onResolve(matchId: string) {
    try {
      await review({
        variables: {
          input: { matchId, homeScore: scoreHome, awayScore: scoreAway },
        },
      });
      toast.success("Score resolved");
      setResolveFor(null);
      await refetch();
    } catch (e) {
      toast.error(
        "Could not resolve",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  return (
    <div className="flex flex-col">
      <PageTitle
        title="Score submissions"
        eyebrow={<span>Admin · Captain submissions</span>}
        meta={
          <>
            <Badge variant="neutral" size="sm">
              {submissions.length} total
            </Badge>
            {conflictCount > 0 ? (
              <Badge variant="warning" size="sm">
                {conflictCount} in conflict
              </Badge>
            ) : null}
          </>
        }
      />
      <div className="p-8 space-y-4">
        {/* Filter bar */}
        <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-card/40 px-3 py-3">
          <div className="space-y-1.5 min-w-[16rem]">
            <Label className="text-xs">Competition</Label>
            <CompetitionAutocomplete
              value={competitionFilter}
              onChange={setCompetitionFilter}
              placeholder="All competitions"
            />
          </div>
          <div className="space-y-1.5 min-w-[10rem]">
            <Label className="text-xs">Status</Label>
            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
              placeholder="All statuses"
              options={[
                { value: "", label: "All statuses" },
                { value: "CONFLICT", label: "Conflict" },
                { value: "PENDING", label: "Pending" },
                { value: "AUTO_APPROVED", label: "Auto-approved" },
                { value: "APPROVED", label: "Approved" },
                { value: "REJECTED", label: "Rejected" },
              ]}
            />
          </div>
          {(competitionFilter || statusFilter) ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setCompetitionFilter("");
                setStatusFilter("");
              }}
            >
              Clear filters
            </Button>
          ) : null}
          <span className="ml-auto text-xs text-muted-foreground">
            {matches.length}{" "}
            {matches.length === 1 ? "match" : "matches"} shown
          </span>
        </div>

        {loading && submissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No submissions yet.</p>
        ) : (
          matches.map(([matchId, subs]) => {
            const m = subs[0].match;
            const conflict = subs.some((s) => s.status === "CONFLICT");
            const auto = subs.some((s) => s.status === "AUTO_APPROVED");
            return (
              <Card
                key={matchId}
                data-testid={`submission-row-${matchId}`}
                className={
                  conflict
                    ? "border-amber-500/60 bg-amber-500/5"
                    : undefined
                }
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base">
                      <Link
                        href={`/matches/${matchId}`}
                        className="hover:underline"
                      >
                        {m.homeTeam?.name ?? "Home"} vs{" "}
                        {m.awayTeam?.name ?? "Away"}
                      </Link>
                      <Link
                        href={`/competitions/${m.matchday.competition.slug}`}
                        className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-normal text-muted-foreground hover:underline"
                      >
                        <Avatar
                          size="sm"
                          src={m.matchday.competition.bannerUrl ?? undefined}
                          fallback={m.matchday.competition.name}
                          shape="competition"
                          className="size-4"
                        />
                        {m.matchday.competition.name} · Matchday{" "}
                        {m.matchday.number}
                      </Link>
                    </CardTitle>
                    {conflict ? (
                      <Badge variant="warning">CONFLICT</Badge>
                    ) : auto ? (
                      <Badge variant="success">AUTO-APPROVED</Badge>
                    ) : (
                      <Badge variant="neutral">{subs[0].status}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {subs.map((s) => (
                      <li
                        key={s.id}
                        className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">
                            {s.submittedBy.name}
                          </span>
                          <span className="font-mono">
                            {s.homeScore} – {s.awayScore}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          @{s.submittedBy.username} · for {s.forTeam.name} ·{" "}
                          {new Date(s.createdAt).toLocaleString()}
                        </div>
                        {s.reviewedBy ? (
                          <div className="mt-1 text-xs text-primary">
                            Reviewed by {s.reviewedBy.name} at{" "}
                            {s.reviewedAt
                              ? new Date(s.reviewedAt).toLocaleString()
                              : ""}
                          </div>
                        ) : s.status === "AUTO_APPROVED" ? (
                          <div className="mt-1 text-xs text-success">
                            Reviewed by Auto at{" "}
                            {s.reviewedAt
                              ? new Date(s.reviewedAt).toLocaleString()
                              : ""}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  {conflict && resolveFor !== matchId ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        setResolveFor(matchId);
                        setScoreHome(subs[0].homeScore);
                        setScoreAway(subs[0].awayScore);
                      }}
                    >
                      Resolve
                    </Button>
                  ) : null}
                  {resolveFor === matchId ? (
                    <div className="flex items-end gap-2 border-t border-border pt-3">
                      <div className="space-y-1.5">
                        <Label>Home</Label>
                        <Input
                          type="number"
                          value={scoreHome}
                          onChange={(e) =>
                            setScoreHome(Number(e.target.value || 0))
                          }
                          className="w-20"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Away</Label>
                        <Input
                          type="number"
                          value={scoreAway}
                          onChange={(e) =>
                            setScoreAway(Number(e.target.value || 0))
                          }
                          className="w-20"
                        />
                      </div>
                      <Button
                        size="sm"
                        loading={reviewing}
                        onClick={() => onResolve(matchId)}
                      >
                        Confirm final score
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setResolveFor(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
