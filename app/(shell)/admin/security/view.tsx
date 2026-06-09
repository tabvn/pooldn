"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@apollo/client/react";
import { ShieldAlert } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { Select } from "@/components/ui/select";
import { PageTitle } from "@/components/layout/page-title";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SecurityEventsQuery } from "@/lib/graphql/operations/security.operations";

const PAGE = 50;

const KIND_BADGE: Record<string, "neutral" | "primary" | "warning" | "success" | "danger"> = {
  LOGIN_OK: "success",
  LOGIN_FAIL: "warning",
  REGISTER: "primary",
  PASSWORD_RESET_REQUEST: "neutral",
  PASSWORD_RESET_REDEEM: "success",
  RATE_LIMITED: "danger",
};

const KIND_OPTIONS = [
  { value: "", label: "All kinds" },
  { value: "LOGIN_OK", label: "Login ok" },
  { value: "LOGIN_FAIL", label: "Login fail" },
  { value: "REGISTER", label: "Register" },
  { value: "PASSWORD_RESET_REQUEST", label: "Password reset · request" },
  { value: "PASSWORD_RESET_REDEEM", label: "Password reset · redeem" },
  { value: "RATE_LIMITED", label: "Rate-limited" },
];

export function SecurityLog() {
  const [kind, setKind] = useState<string>("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);

  const { data, loading, error, fetchMore } = useQuery(SecurityEventsQuery, {
    variables: { kind: kind || null, first: PAGE },
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });
  const rows = data?.securityEvents ?? [];

  async function loadMore() {
    const last = rows[rows.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const r = await fetchMore({
        variables: { after: last.id },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult?.securityEvents) return prev;
          return {
            ...prev,
            securityEvents: [
              ...prev.securityEvents,
              ...fetchMoreResult.securityEvents,
            ],
          };
        },
      });
      const next = r.data?.securityEvents ?? [];
      if (next.length < PAGE) setDone(true);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="flex flex-col">
      <PageTitle
        title="Security log"
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <ShieldAlert className="size-3.5" /> Admin
          </span>
        }
        description="Auth events, password-reset traffic, and rate-limit trips. Newest first."
      />
      <div className="p-4 md:p-8 max-w-6xl space-y-4">
        <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-card/40 px-3 py-3">
          <div className="space-y-1.5 min-w-[14rem]">
            <Label className="text-xs">Kind</Label>
            <Select
              value={kind}
              onValueChange={(v) => {
                setKind(v);
                setDone(false);
              }}
              options={KIND_OPTIONS}
            />
          </div>
          {kind ? (
            <Button size="sm" variant="ghost" onClick={() => setKind("")}>
              Clear
            </Button>
          ) : null}
          <span className="ml-auto text-xs text-muted-foreground">
            {rows.length} loaded
          </span>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>Identifier</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && !data ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        Loading…
                      </p>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <p className="py-10 text-center text-sm text-destructive">
                        Could not load: {error.message}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <p className="py-10 text-center text-sm text-muted-foreground">
                        No events yet.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((e) => (
                    <TableRow key={e.id} data-testid={`sec-row-${e.id}`}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        <LocalDateTime value={e.createdAt} />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={KIND_BADGE[e.kind] ?? "neutral"}
                          size="sm"
                        >
                          {e.kind.replace(/_/g, " ").toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {e.user ? (
                          <Link
                            href={`/players/${e.user.username}`}
                            className="inline-flex items-center gap-2 hover:underline"
                          >
                            <Avatar
                              size="sm"
                              src={e.user.avatarUrl ?? undefined}
                              fallback={e.user.name}
                            />
                            <span className="text-sm font-medium">
                              {e.user.name}
                            </span>
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {e.identifier ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {e.ip ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {e.country ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs">
                        {e.note ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {!done && rows.length >= PAGE ? (
          <div className="flex justify-center">
            <Button
              variant="outline"
              loading={loadingMore}
              onClick={loadMore}
              data-testid="security-load-more"
            >
              Load more
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
