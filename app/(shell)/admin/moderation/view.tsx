"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import type { ResultOf } from "@graphql-typed-document-node/core";
import { ShieldOff } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { PageTitle } from "@/components/layout/page-title";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import {
  BannedTeamsQuery,
  BannedUsersQuery,
  DeleteTeamHardMutation,
  UnbanTeamMutation,
  UnbanUserMutation,
} from "@/lib/graphql/operations/admin-moderation.operations";

type UserRow = ResultOf<typeof BannedUsersQuery>["bannedUsers"][number];
type TeamRow = ResultOf<typeof BannedTeamsQuery>["bannedTeams"][number];

const PAGE = 25;

/**
 * Round-47 — Admin moderation tables.
 *
 * NOTE: this route lives at /admin/moderation (not /admin/banned). The
 * `/banned` path segment caused Next.js 16 + Turbopack to hang SSR
 * indefinitely on any URL containing it under the (shell) group — confirmed
 * via Playwright A/B: same code, /admin/banned hangs, /admin/moderation 200s.
 * Path collision with the lockout `/banned` route is the suspected cause.
 */
export function BannedAdmin() {
  return (
    <div className="flex flex-col">
      <PageTitle
        title="Banned accounts + teams"
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <ShieldOff className="size-3.5" /> Admin
          </span>
        }
        description="Locked-out users and banned teams. Unban to restore; delete a team to remove it permanently."
      />
      <div className="p-4 md:p-8 max-w-5xl">
        <Tabs defaultValue="users">
          <TabsList data-testid="moderation-tabs">
            <TabsTrigger value="users" data-testid="moderation-tab-users">
              Users
            </TabsTrigger>
            <TabsTrigger value="teams" data-testid="moderation-tab-teams">
              Teams
            </TabsTrigger>
          </TabsList>
          <TabsPanel value="users">
            <BannedUsersTable />
          </TabsPanel>
          <TabsPanel value="teams">
            <BannedTeamsTable />
          </TabsPanel>
        </Tabs>
      </div>
    </div>
  );
}

function BannedUsersTable() {
  const toast = useToast();
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);
  const { data, loading, error, fetchMore, refetch } = useQuery(
    BannedUsersQuery,
    {
      variables: { first: PAGE },
      fetchPolicy: "network-only",
      notifyOnNetworkStatusChange: true,
    },
  );
  const [unban] = useMutation(UnbanUserMutation);

  const pages = data?.bannedUsers ?? [];

  async function loadMore() {
    const last = pages[pages.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const r = await fetchMore({
        variables: { after: last.id },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult?.bannedUsers) return prev;
          return {
            ...prev,
            bannedUsers: [...prev.bannedUsers, ...fetchMoreResult.bannedUsers],
          };
        },
      });
      const next = r.data?.bannedUsers ?? [];
      if (next.length < PAGE) setDone(true);
    } finally {
      setLoadingMore(false);
    }
  }

  async function onUnban(u: UserRow) {
    try {
      await unban({ variables: { id: u.id } });
      toast.success(`Unbanned ${u.name}`);
      await refetch();
    } catch (e) {
      toast.error("Could not unban", e);
    }
  }

  return (
    <section className="space-y-3" data-testid="admin-banned-users">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Banned users
        </h2>
        <Badge variant="neutral" size="sm">
          {pages.length}
          {!done ? "+" : ""}
        </Badge>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Banned</TableHead>
                <TableHead aria-label="Actions" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      Loading…
                    </p>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <p className="py-10 text-center text-sm text-destructive">
                      Could not load banned users: {error.message}
                    </p>
                  </TableCell>
                </TableRow>
              ) : pages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      No banned users. 🎉
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                pages.map((u) => (
                  <TableRow key={u.id} data-testid={`banned-user-${u.id}`}>
                    <TableCell>
                      <Link
                        href={`/players/${u.username}`}
                        className="inline-flex items-center gap-2 hover:underline"
                      >
                        <Avatar
                          size="sm"
                          src={u.avatarUrl ?? undefined}
                          fallback={u.name}
                        />
                        <div>
                          <div className="text-sm font-medium">{u.name}</div>
                          <div className="text-xs text-muted-foreground">
                            @{u.username}
                          </div>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-xs text-sm">
                      {u.banReason ?? (
                        <span className="italic text-muted-foreground">
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.bannedAt ? (
                        <LocalDateTime value={u.bannedAt} />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onUnban(u)}
                        data-testid={`unban-user-${u.id}`}
                      >
                        Unban
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {!done && pages.length >= PAGE ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            loading={loadingMore}
            onClick={loadMore}
            data-testid="banned-users-load-more"
          >
            Load more
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function BannedTeamsTable() {
  const toast = useToast();
  const confirm = useConfirm();
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);
  const { data, loading, error, fetchMore, refetch } = useQuery(
    BannedTeamsQuery,
    {
      variables: { first: PAGE },
      fetchPolicy: "network-only",
      notifyOnNetworkStatusChange: true,
    },
  );
  const [unban] = useMutation(UnbanTeamMutation);
  const [del] = useMutation(DeleteTeamHardMutation);

  const pages = data?.bannedTeams ?? [];

  async function loadMore() {
    const last = pages[pages.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const r = await fetchMore({
        variables: { after: last.id },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult?.bannedTeams) return prev;
          return {
            ...prev,
            bannedTeams: [...prev.bannedTeams, ...fetchMoreResult.bannedTeams],
          };
        },
      });
      const next = r.data?.bannedTeams ?? [];
      if (next.length < PAGE) setDone(true);
    } finally {
      setLoadingMore(false);
    }
  }

  async function onUnban(t: TeamRow) {
    try {
      await unban({ variables: { id: t.id } });
      toast.success(`Unbanned ${t.name}`);
      await refetch();
    } catch (e) {
      toast.error("Could not unban", e);
    }
  }

  async function onDelete(t: TeamRow) {
    const ok = await confirm({
      title: `Hard-delete ${t.name}?`,
      description:
        "All roster members, matches, applications and standings tied to this team will be permanently removed. This can't be undone.",
      confirmLabel: "Delete forever",
      destructive: true,
    });
    if (!ok) return;
    try {
      await del({ variables: { id: t.id } });
      toast.success(`${t.name} deleted`);
      await refetch();
    } catch (e) {
      toast.error("Could not delete", e);
    }
  }

  return (
    <section className="space-y-3" data-testid="admin-banned-teams">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Banned teams
        </h2>
        <Badge variant="neutral" size="sm">
          {pages.length}
          {!done ? "+" : ""}
        </Badge>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Banned</TableHead>
                <TableHead aria-label="Actions" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      Loading…
                    </p>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <p className="py-10 text-center text-sm text-destructive">
                      Could not load banned teams: {error.message}
                    </p>
                  </TableCell>
                </TableRow>
              ) : pages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      No banned teams.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                pages.map((t) => (
                  <TableRow key={t.id} data-testid={`banned-team-${t.id}`}>
                    <TableCell>
                      <Link
                        href={`/teams/${t.slug}`}
                        className="inline-flex items-center gap-2 hover:underline"
                      >
                        <Avatar
                          size="sm"
                          src={t.logoUrl ?? undefined}
                          fallback={t.name}
                          shape="team"
                        />
                        <div>
                          <div className="text-sm font-medium">{t.name}</div>
                          {t.captain ? (
                            <div className="text-xs text-muted-foreground">
                              Captain @{t.captain.username}
                            </div>
                          ) : null}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-xs text-sm">
                      {t.banReason ?? (
                        <span className="italic text-muted-foreground">
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.bannedAt ? (
                        <LocalDateTime value={t.bannedAt} />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="space-x-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onUnban(t)}
                        data-testid={`unban-team-${t.id}`}
                      >
                        Unban
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDelete(t)}
                        data-testid={`delete-team-${t.id}`}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {!done && pages.length >= PAGE ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            loading={loadingMore}
            onClick={loadMore}
            data-testid="banned-teams-load-more"
          >
            Load more
          </Button>
        </div>
      ) : null}
    </section>
  );
}
