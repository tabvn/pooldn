"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  Ghost,
  Link2,
  Copy,
  Check,
  Trash2,
  GitMerge,
  UserPlus,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CountryFlag } from "@/components/ui/country-flag";
import { Input } from "@/components/ui/input";
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
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  DeleteShellPlayerMutation,
  MergeShellIntoPlayerMutation,
  ReissueClaimLinkMutation,
  ShellPlayersQuery,
  ShellTeamsQuery,
} from "@/lib/graphql/operations/league-import.operations";
import { UsersDirectoryQuery } from "@/lib/graphql/operations/team-mutations.operations";
import {
  CreateShellPlayersForm,
  ImportShellTeamForm,
} from "@/components/admin/shell-forms";
import { ClaimReviewList } from "@/components/shell/claim-review-list";
import { errorText } from "@/lib/apollo/error-message";

const PAGE = 50;

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "UNCLAIMED", label: "Unclaimed" },
  { value: "CLAIMED", label: "Claimed" },
];

/**
 * Round-85 — everything the offline-league import created, in one place.
 *
 * Claim tokens are stored hashed, so the URL handed out at import time can
 * never be shown again. This screen therefore reports *state* — still a
 * placeholder vs taken over, and by which team — and re-issues a fresh link
 * when the original goes missing.
 */
export function ShellsAdmin() {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<"players" | "teams" | "claims">("players");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [done, setDone] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  /** userId → freshly minted claim URL, shown until the admin navigates away. */
  const [links, setLinks] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  /** Which creation form is open, if any. */
  const [creating, setCreating] = useState<"player" | "team" | null>(null);

  const players = useQuery(ShellPlayersQuery, {
    variables: {
      status: status || null,
      search: search.trim() || null,
      first: PAGE,
    },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
    skip: tab !== "players",
  });
  const teams = useQuery(ShellTeamsQuery, {
    variables: { search: search.trim() || null },
    fetchPolicy: "cache-and-network",
    skip: tab !== "teams",
  });
  const [reissue, { loading: reissuing }] = useMutation(
    ReissueClaimLinkMutation,
  );
  const [removeShell, { loading: deleting }] = useMutation(
    DeleteShellPlayerMutation,
  );
  const [merge, { loading: merging }] = useMutation(
    MergeShellIntoPlayerMutation,
  );
  // Only loaded once the admin opens the merge picker — the directory is the
  // full player list and this screen usually doesn't need it.
  const [mergeFor, setMergeFor] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [mergeSearch, setMergeSearch] = useState("");
  const directory = useQuery(UsersDirectoryQuery, {
    fetchPolicy: "cache-first",
    skip: !mergeFor,
  });

  const rows = players.data?.shellPlayers ?? [];
  const teamRows = teams.data?.shellTeams ?? [];

  async function loadMore() {
    const last = rows[rows.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const r = await players.fetchMore({
        variables: { after: last.id },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult?.shellPlayers) return prev;
          return {
            ...prev,
            shellPlayers: [...prev.shellPlayers, ...fetchMoreResult.shellPlayers],
          };
        },
      });
      if ((r.data?.shellPlayers ?? []).length < PAGE) setDone(true);
    } finally {
      setLoadingMore(false);
    }
  }

  async function onReissue(userId: string) {
    try {
      const r = await reissue({ variables: { userId } });
      const url = r.data?.reissueClaimLink?.claimUrl;
      if (url) {
        setLinks((p) => ({ ...p, [userId]: url }));
        toast.success(
          "New claim link ready",
          "Copy it now — it can't be shown again once you leave this page.",
        );
      }
    } catch (e) {
      toast.error(
        "Couldn't re-issue",
        errorText(e, "Try again."),
      );
    }
  }

  async function onDelete(userId: string, name: string) {
    const ok = await confirm({
      title: `Delete ${name}?`,
      description:
        "The placeholder profile and its claim links are removed. This can't be undone. Shells with match results can't be deleted — merge those into the real account instead.",
      confirmLabel: "Delete shell",
      destructive: true,
    });
    if (!ok) return;
    try {
      await removeShell({ variables: { userId } });
      toast.success("Shell deleted");
      await players.refetch();
    } catch (e) {
      toast.error(
        "Couldn't delete",
        errorText(e, "Try again."),
      );
    }
  }

  async function onMerge(targetUserId: string, targetName: string) {
    if (!mergeFor) return;
    const ok = await confirm({
      title: `Merge ${mergeFor.name} into ${targetName}?`,
      description:
        "Every team, roster spot, match and stat on the placeholder moves to that account, and the placeholder is removed. This can't be undone.",
      confirmLabel: "Merge",
      destructive: true,
    });
    if (!ok) return;
    try {
      const r = await merge({
        variables: { shellUserId: mergeFor.id, targetUserId },
      });
      const m = r.data?.mergeShellIntoPlayer;
      toast.success(
        `Merged into ${targetName}`,
        m
          ? `${m.matchesMoved} match${m.matchesMoved === 1 ? "" : "es"}, ${m.framesMoved} frame${m.framesMoved === 1 ? "" : "s"}, ${m.teamsMoved} team${m.teamsMoved === 1 ? "" : "s"} moved.`
          : undefined,
      );
      setMergeFor(null);
      setMergeSearch("");
      await players.refetch();
    } catch (e) {
      toast.error(
        "Couldn't merge",
        errorText(e, "Try again."),
      );
    }
  }

  async function copy(userId: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(userId);
      setTimeout(() => setCopied((c) => (c === userId ? null : c)), 2000);
    } catch {
      toast.error("Couldn't copy", "Select the link and copy it manually.");
    }
  }

  return (
    <div className="flex flex-col">
      <PageTitle
        title="Shell players & teams"
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <Ghost className="size-3.5" /> Admin
          </span>
        }
        description="Every placeholder profile in the app — created by the offline-league import or by an organizer inside their own competition — the teams built from them, and the claims waiting on a decision. A placeholder can't sign in until a real person claims it."
      />
      <div className="max-w-6xl space-y-4 p-4 md:p-8">
        <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-card/40 px-3 py-3">
          <div className="flex gap-1 rounded-md border border-border p-1">
            {(["players", "teams", "claims"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setTab(k);
                  setDone(false);
                }}
                data-active={tab === k || undefined}
                data-testid={`shells-tab-${k}`}
                className={
                  "rounded px-3 py-1.5 text-sm font-semibold capitalize transition-colors " +
                  (tab === k
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary/50")
                }
              >
                {k}
              </button>
            ))}
          </div>
          {tab === "players" ? (
            <div className="min-w-[12rem] space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v);
                  setDone(false);
                }}
                options={STATUS_OPTIONS}
              />
            </div>
          ) : null}
          {/* The claim queue has its own pending/all filter and no search. */}
          {tab === "claims" ? null : (
            <div className="min-w-[16rem] flex-1 space-y-1.5">
              <Label className="text-xs">Search</Label>
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setDone(false);
                }}
                placeholder={
                  tab === "players" ? "Name or username…" : "Team name…"
                }
                data-testid="shells-search"
              />
            </div>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {tab === "claims"
              ? "Requests to review"
              : `${tab === "players" ? rows.length : teamRows.length} shown`}
          </span>
        </div>

        {/* Round-87 — create shells without leaving the screen that lists
            them. Same forms as /admin/league-import (shared component), so
            the claim links they mint are still shown exactly once.
            Round-88 — not on the claims tab: that view is about handing
            existing placeholders over, not minting new ones. */}
        <div className={tab === "claims" ? "hidden" : "flex flex-wrap gap-2"}>
          <Button
            variant={creating === "player" ? "secondary" : "primary"}
            size="sm"
            onClick={() =>
              setCreating((c) => (c === "player" ? null : "player"))
            }
            data-testid="new-shell-player"
          >
            <UserPlus className="size-4" />
            New shell player
          </Button>
          <Button
            variant={creating === "team" ? "secondary" : "primary"}
            size="sm"
            onClick={() => setCreating((c) => (c === "team" ? null : "team"))}
            data-testid="new-shell-team"
          >
            <Users className="size-4" />
            New shell team
          </Button>
          {creating ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCreating(null)}
              data-testid="close-shell-form"
            >
              Close
            </Button>
          ) : null}
        </div>

        {creating && tab !== "claims" ? (
          <Card data-testid="shell-create-form">
            <CardContent className="p-4">
              {creating === "player" ? (
                <CreateShellPlayersForm
                  onCreated={() => {
                    void players.refetch();
                  }}
                />
              ) : (
                <ImportShellTeamForm
                  onCreated={() => {
                    void players.refetch();
                    void teams.refetch();
                  }}
                />
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* Round-86 — merge picker. Shown inline rather than in a dialog so
            the shell row it refers to stays on screen. */}
        {mergeFor ? (
          <Card data-testid="merge-picker">
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm">
                  Merge{" "}
                  <span className="font-semibold">{mergeFor.name}</span> into
                  which account?
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setMergeFor(null);
                    setMergeSearch("");
                  }}
                >
                  Cancel
                </Button>
              </div>
              <Input
                value={mergeSearch}
                onChange={(e) => setMergeSearch(e.target.value)}
                placeholder="Search players…"
                data-testid="merge-search"
              />
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {(directory.data?.users ?? [])
                  .filter(
                    (u) =>
                      u.id !== mergeFor.id &&
                      (mergeSearch.trim() === "" ||
                        u.name
                          .toLowerCase()
                          .includes(mergeSearch.trim().toLowerCase()) ||
                        u.username
                          .toLowerCase()
                          .includes(mergeSearch.trim().toLowerCase())),
                  )
                  .slice(0, 25)
                  .map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => onMerge(u.id, u.name)}
                        disabled={merging}
                        className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary/50 disabled:opacity-60"
                        data-testid={`merge-target-${u.username}`}
                      >
                        <Avatar
                          size="sm"
                          src={u.avatarUrl ?? undefined}
                          fallback={u.name}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {u.name}
                          <span className="ml-1 text-xs text-muted-foreground">
                            @{u.username}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                {directory.loading ? (
                  <li className="py-3 text-center text-sm text-muted-foreground">
                    Loading players…
                  </li>
                ) : null}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {tab === "claims" ? (
          // Round-88 — every claim in the app, on any placeholder. Organizers
          // see the same list scoped to their own competition on
          // /competitions/<slug>/claims.
          <ClaimReviewList emptyHint="Nobody has asked to claim a placeholder profile yet." />
        ) : tab === "players" ? (
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {players.loading && !players.data ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <p className="py-6 text-center text-sm text-muted-foreground">
                          Loading…
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <p className="py-6 text-center text-sm text-muted-foreground">
                          No shell players yet — they appear here once you run a
                          league import.
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((p) => (
                      <TableRow key={p.id} data-testid={`shell-player-${p.id}`}>
                        <TableCell>
                          <Link
                            href={`/players/${p.username}`}
                            className="inline-flex items-center gap-2.5 font-medium hover:underline"
                          >
                            <Avatar
                              size="sm"
                              src={p.avatarUrl ?? undefined}
                              fallback={p.name}
                              ghost={p.isShell}
                            />
                            <span className="min-w-0">
                              <span className="block truncate">
                                {p.name}
                                <CountryFlag
                                  code={p.nationality}
                                  className="ml-1 leading-none"
                                />
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                @{p.username}
                              </span>
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell>
                          {p.isShell ? (
                            <Badge variant="warning">Unclaimed</Badge>
                          ) : (
                            <Badge variant="success">Claimed</Badge>
                          )}
                          {p.claimedAt ? (
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              <LocalDateTime value={p.claimedAt} variant="date" />
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {p.city?.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <LocalDateTime value={p.createdAt} variant="date" />
                        </TableCell>
                        <TableCell className="text-right">
                          {!p.isShell ? (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          ) : links[p.id] ? (
                            <div className="flex items-center justify-end gap-2">
                              <code className="max-w-[16rem] truncate rounded bg-secondary/60 px-2 py-1 text-xs">
                                {links[p.id]}
                              </code>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => copy(p.id, links[p.id])}
                                data-testid={`copy-claim-${p.id}`}
                              >
                                {copied === p.id ? (
                                  <Check className="size-4" />
                                ) : (
                                  <Copy className="size-4" />
                                )}
                                {copied === p.id ? "Copied" : "Copy"}
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                loading={reissuing}
                                onClick={() => onReissue(p.id)}
                                data-testid={`reissue-claim-${p.id}`}
                              >
                                <Link2 className="size-4" />
                                New link
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                loading={merging}
                                onClick={() =>
                                  setMergeFor({ id: p.id, name: p.name })
                                }
                                data-testid={`merge-shell-${p.id}`}
                              >
                                <GitMerge className="size-4" />
                                Merge
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                loading={deleting}
                                onClick={() => onDelete(p.id, p.name)}
                                data-testid={`delete-shell-${p.id}`}
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Roster</TableHead>
                    <TableHead>Unclaimed</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teams.loading && !teams.data ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <p className="py-6 text-center text-sm text-muted-foreground">
                          Loading…
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : teamRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <p className="py-6 text-center text-sm text-muted-foreground">
                          No imported teams yet.
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    teamRows.map((t) => (
                      <TableRow key={t.id} data-testid={`shell-team-${t.id}`}>
                        <TableCell>
                          <Link
                            href={`/teams/${t.slug}`}
                            className="inline-flex items-center gap-2.5 font-medium hover:underline"
                          >
                            <Avatar
                              size="sm"
                              src={t.logoUrl ?? undefined}
                              fallback={t.name}
                              shape="team"
                            />
                            {t.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {t.cityName ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {t.memberCount} player
                          {t.memberCount === 1 ? "" : "s"}
                        </TableCell>
                        <TableCell>
                          {t.shellCount > 0 ? (
                            <Badge variant="warning">
                              {t.shellCount} of {t.memberCount}
                            </Badge>
                          ) : (
                            <Badge variant="success">All claimed</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <LocalDateTime value={t.createdAt} variant="date" />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {tab === "players" && rows.length >= PAGE && !done ? (
          <div className="flex justify-center">
            <Button
              variant="secondary"
              loading={loadingMore}
              onClick={loadMore}
              data-testid="shells-load-more"
            >
              Load more
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
