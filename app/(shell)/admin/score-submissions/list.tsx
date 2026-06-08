"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageTitle } from "@/components/layout/page-title";
import type { ResultOf } from "@graphql-typed-document-node/core";
import {
  MatchScoreSubmissionsListQuery,
  ReviewMatchScoreMutation,
} from "@/lib/graphql/operations/score-submission.operations";

type Submission = NonNullable<
  ResultOf<typeof MatchScoreSubmissionsListQuery>["matchScoreSubmissions"]
>[number];

export function SubmissionsList() {
  const { data, loading, refetch } = useQuery(MatchScoreSubmissionsListQuery);
  const [review, { loading: reviewing }] = useMutation(ReviewMatchScoreMutation);
  const [resolveFor, setResolveFor] = useState<string | null>(null);
  const [scoreHome, setScoreHome] = useState<number>(0);
  const [scoreAway, setScoreAway] = useState<number>(0);

  const submissions = data?.matchScoreSubmissions ?? [];
  // Group by match id for compact display.
  const byMatch = new Map<string, Submission[]>();
  for (const s of submissions as Submission[]) {
    const arr = byMatch.get(s.match.id) ?? [];
    arr.push(s);
    byMatch.set(s.match.id, arr);
  }
  const matches = Array.from(byMatch.entries());

  async function onResolve(matchId: string) {
    await review({
      variables: {
        input: { matchId, homeScore: scoreHome, awayScore: scoreAway },
      },
    });
    setResolveFor(null);
    await refetch();
  }

  return (
    <div className="flex flex-col">
      <PageTitle
        title="Score submissions"
        eyebrow={<span>Admin · Captain submissions</span>}
        meta={
          <Badge variant="neutral" size="sm">
            {submissions.length} total
          </Badge>
        }
      />
      <div className="p-8 space-y-4">
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
                      <span className="block text-xs font-normal text-muted-foreground">
                        {m.matchday.competition.name} · Matchday{" "}
                        {m.matchday.number}
                      </span>
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
