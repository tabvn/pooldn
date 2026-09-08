"use client";

import Link from "next/link";
import { useQuery } from "@apollo/client/react";
import { Ghost } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { RelativeTime } from "@/components/ui/relative-time";
import { ClaimReviewList } from "@/components/shell/claim-review-list";
import { MyShellClaimsQuery } from "@/lib/graphql/operations/shell-claim.operations";

/**
 * Round-88 — both halves of the claim flow on one screen: what the viewer
 * asked for, and what is waiting on them. The review queue renders empty (with
 * an explanation) for a player who organizes nothing, so there's no role gate
 * on the page itself — the server already scopes the rows.
 */
export function ClaimsView({ isAdmin }: { isAdmin: boolean }) {
  const { data } = useQuery(MyShellClaimsQuery, {
    fetchPolicy: "cache-and-network",
  });
  const mine = data?.myShellClaims ?? [];

  return (
    <>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          To review
        </h2>
        <ClaimReviewList
          emptyHint={
            isAdmin
              ? "Nobody has asked to claim a placeholder profile yet."
              : "Claims on players in the competitions you organize land here. Nothing waiting."
          }
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Your claims
        </h2>
        {mine.length === 0 ? (
          <Card>
            <CardContent className="space-y-1 py-8 text-center">
              <Ghost className="mx-auto size-6 text-muted-foreground" />
              <p className="text-sm font-medium">
                You haven&apos;t claimed any profiles
              </p>
              <p className="text-sm text-muted-foreground">
                If an organizer entered your results before you joined Play
                Pool, open that placeholder profile and tell them it&apos;s you.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {mine.map((c) => (
              <li key={c.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-center gap-3 py-4">
                    <Ghost className="size-4 text-muted-foreground" />
                    {c.status === "APPROVED" ? (
                      // Approved means merged: the placeholder is gone, so
                      // there's nothing left to link to.
                      <span className="text-sm font-semibold">
                        {c.shellName}
                      </span>
                    ) : (
                      <Link
                        href={`/players/${c.shellUsername}`}
                        className="text-sm font-semibold hover:underline"
                      >
                        {c.shellName}
                      </Link>
                    )}
                    <StatusBadge status={c.status} />
                    <span className="text-xs text-muted-foreground">
                      asked <RelativeTime value={c.createdAt} />
                    </span>
                    {c.reviewNote ? (
                      <span className="w-full text-sm text-muted-foreground">
                        “{c.reviewNote}”
                      </span>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "PENDING") return <Badge variant="warning">Pending</Badge>;
  if (status === "APPROVED") return <Badge variant="success">Approved</Badge>;
  if (status === "REJECTED") return <Badge variant="danger">Not approved</Badge>;
  return <Badge variant="neutral">Withdrawn</Badge>;
}
