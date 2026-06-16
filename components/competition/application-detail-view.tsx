"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client/react";
import type { ResultOf } from "@graphql-typed-document-node/core";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Lock,
  Pencil,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CountryFlag } from "@/components/ui/country-flag";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApplicationStatusChip } from "@/components/ui/status-chip";
import { useToast } from "@/components/ui/toast";
import { CompetitionApplicationDetailQuery } from "@/lib/graphql/operations/competition.operations";
import {
  CancelRosterChangeRequestMutation,
  DecideRosterChangeRequestMutation,
  EditApplicationRosterMutation,
  RequestRosterChangeMutation,
  ReviewApplicationMutation,
} from "@/lib/graphql/operations/competition-mutations.operations";

/**
 * Round-50 — reusable Application (players) detail view.
 *
 * Mounts in two surfaces:
 *  - `/competitions/[slug]/applications/[appId]` page
 *  - A modal preview triggered from the applications list (organizer can
 *    inspect the proposed roster before approving the application).
 *
 * Role-driven affordances:
 *  - Captain on APPROVED + comp unlocked → "Propose roster change"
 *    (creates a PENDING RosterChangeRequest).
 *  - Org/admin on APPROVED → "Edit roster" (in-place via
 *    editApplicationRoster; cancels any pending captain proposal).
 *  - Org/admin on PENDING → "Approve" / "Reject" the application itself.
 *  - Org/admin on PENDING roster change request → "Approve" / "Reject"
 *    the change request.
 */
export function ApplicationDetailView({
  applicationId,
  viewerId,
  viewerRole,
  onClose,
}: {
  applicationId: string;
  viewerId: string | null;
  viewerRole: string | null;
  onClose?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const { data, loading, refetch } = useQuery(
    CompetitionApplicationDetailQuery,
    { variables: { id: applicationId }, fetchPolicy: "cache-and-network" },
  );

  const [reviewApp, { loading: reviewing }] = useMutation(
    ReviewApplicationMutation,
  );
  const [editRoster, { loading: editing }] = useMutation(
    EditApplicationRosterMutation,
  );
  const [proposeChange, { loading: proposing }] = useMutation(
    RequestRosterChangeMutation,
  );
  const [decideChange, { loading: deciding }] = useMutation(
    DecideRosterChangeRequestMutation,
  );
  const [cancelChange, { loading: cancelling }] = useMutation(
    CancelRosterChangeRequestMutation,
  );

  const [mode, setMode] = useState<"view" | "edit-org" | "edit-captain">("view");

  const app = data?.competitionApplication;

  if (loading && !app) {
    return <Skeleton />;
  }
  if (!app) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Application not found.
      </div>
    );
  }
  // Round-53 — solo (INDIVIDUAL) applications have no team, no roster, and
  // no roster captain — the rest of this view assumes them. For now we
  // render a minimal placeholder; a Round-54 follow-up will build the
  // dedicated solo detail view.
  if (!app.team) {
    return (
      <div className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
        Solo (Singles) applications don't have a roster view yet.
      </div>
    );
  }

  const isAdmin = viewerRole === "SUPER_ADMIN";
  const isOrganizer = viewerId === app.competition.organizer.id;
  const isCaptain = viewerId === app.team.captain.id;
  const canOrgEdit = isOrganizer || isAdmin;
  const lockedRoster = app.applicationPlayers.map((p) => ({
    id: p.user.id,
    name: p.user.name,
    username: p.user.username,
    nationality: p.user.nationality,
    avatarUrl: p.user.avatarUrl,
  }));
  const pendingChange =
    app.rosterChangeRequests.find((r) => r.status === "PENDING") ?? null;
  const historicalChanges = app.rosterChangeRequests.filter(
    (r) => r.status !== "PENDING",
  );

  const canCaptainPropose =
    isCaptain &&
    app.status === "APPROVED" &&
    !app.competition.rosterLocked &&
    !pendingChange;

  // Stable non-null id closure for callbacks (TS narrowing doesn't survive
  // the async closures otherwise).
  const appId = app.id;

  async function approveApp() {
    try {
      await reviewApp({
        variables: { input: { applicationId: appId, approve: true } },
      });
      toast.success("Application approved", "Team is locked in.");
      await refetch();
      router.refresh();
    } catch (e) {
      toast.error(
        "Could not approve",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }
  async function rejectApp() {
    try {
      await reviewApp({
        variables: { input: { applicationId: appId, approve: false } },
      });
      toast.success("Application rejected");
      await refetch();
      router.refresh();
    } catch (e) {
      toast.error(
        "Could not reject",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  async function decideChangeRequest(approve: boolean) {
    if (!pendingChange) return;
    try {
      await decideChange({
        variables: { id: pendingChange.id, approve },
      });
      toast.success(
        approve ? "Roster change approved" : "Roster change rejected",
      );
      await refetch();
      router.refresh();
    } catch (e) {
      toast.error(
        "Could not finalize",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  async function withdrawChangeRequest() {
    if (!pendingChange) return;
    try {
      await cancelChange({ variables: { id: pendingChange.id } });
      toast.success("Proposal withdrawn");
      await refetch();
      router.refresh();
    } catch (e) {
      toast.error(
        "Could not withdraw",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Avatar
            size="lg"
            src={app.team.logoUrl ?? undefined}
            fallback={app.team.name}
            shape="team"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href={`/teams/${app.team.slug}`}
                className="text-xl font-semibold hover:underline"
              >
                {app.team.name}
              </Link>
              <ApplicationStatusChip status={app.status} />
            </div>
            <div className="text-xs text-muted-foreground">
              Captain:{" "}
              <Link
                href={`/players/${app.team.captain.username}`}
                className="hover:underline"
              >
                {app.team.captain.name}
              </Link>
              <CountryFlag
                code={app.team.captain.nationality}
                className="ml-1 leading-none"
              />
              {" · "}
              Applied {fmtDate(app.submittedAt)}
              {app.rosterCaptain ? (
                <>
                  {" · "}Roster Captain:{" "}
                  <Link
                    href={`/players/${app.rosterCaptain.username}`}
                    className="hover:underline"
                  >
                    {app.rosterCaptain.name}
                  </Link>
                  <CountryFlag
                    code={app.rosterCaptain.nationality}
                    className="ml-1 leading-none"
                  />
                </>
              ) : null}
            </div>
          </div>
        </div>
        {onClose ? (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="size-4" /> Close
          </Button>
        ) : null}
      </header>

      {/* Org-side approve/reject for PENDING application */}
      {canOrgEdit && app.status === "PENDING" ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/40 bg-warning/5 p-3">
          <AlertCircle className="size-4 text-warning" />
          <div className="flex-1 text-sm">
            This application is awaiting your review.
          </div>
          <Button
            variant="success"
            size="sm"
            loading={reviewing}
            onClick={approveApp}
            data-testid="approve-application"
          >
            <Check className="size-4" /> Approve
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={reviewing}
            onClick={rejectApp}
            data-testid="reject-application"
          >
            <X className="size-4" /> Reject
          </Button>
        </div>
      ) : null}

      {/* Round-50 — top-of-view attention banner so org/admin landing on
          the page or sheet sees the change request immediately, not buried
          below the current roster. */}
      {pendingChange && canOrgEdit ? (
        <a
          href="#pending-roster-change"
          className="group flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 transition-colors hover:bg-primary/15"
          data-testid="pending-roster-change-banner"
        >
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
            <AlertCircle className="size-4" />
          </span>
          <div className="flex-1">
            <div className="text-sm font-semibold">
              {pendingChange.requestedBy.name} proposed a roster change
            </div>
            <div className="text-xs text-muted-foreground">
              {pendingChange.proposedPlayers.length} player
              {pendingChange.proposedPlayers.length === 1 ? "" : "s"} in the
              proposal · awaiting your review
            </div>
          </div>
          <span className="text-xs font-semibold text-primary group-hover:underline">
            Review below →
          </span>
        </a>
      ) : null}
      {pendingChange && isCaptain && pendingChange.requestedBy.id === viewerId ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3"
          data-testid="pending-roster-change-self-banner"
        >
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
            <AlertCircle className="size-4" />
          </span>
          <div className="flex-1 text-sm">
            <span className="font-semibold">Waiting on the organizer.</span>{" "}
            Your proposed roster change is queued for review.
          </div>
        </div>
      ) : null}

      {/* Lock indicators */}
      {app.competition.rosterLocked ? (
        <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-sm">
          <Lock className="size-4 text-warning" />
          <span>
            Roster edits are locked by the organizer. Captains can&apos;t
            propose changes right now.
          </span>
        </div>
      ) : null}

      {/* Current locked roster */}
      <section>
        <header className="mb-2 flex items-baseline justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Current roster
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {lockedRoster.length} player
              {lockedRoster.length === 1 ? "" : "s"}
            </span>
            {canCaptainPropose && mode === "view" ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setMode("edit-captain")}
                data-testid="propose-roster-change"
              >
                <Pencil className="size-4" /> Propose change
              </Button>
            ) : null}
            {canOrgEdit && app.status === "APPROVED" && mode === "view" ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setMode("edit-org")}
                data-testid="edit-roster-org"
              >
                <Pencil className="size-4" /> Edit roster
              </Button>
            ) : null}
          </div>
        </header>
        <PlayerGrid players={lockedRoster} />
      </section>

      {/* Pending change request — kept off the public surface. Only the
          captain who proposed it (to withdraw) or org/admin (to review) see
          the panel; everyone else sees the locked roster only. */}
      {pendingChange &&
      (canOrgEdit ||
        (isCaptain && pendingChange.requestedBy.id === viewerId)) ? (
        <section
          id="pending-roster-change"
          className="space-y-4 rounded-xl border border-primary/40 bg-primary/5 p-4 md:p-5 scroll-mt-4"
          data-testid="pending-roster-change"
        >
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-primary">
                Proposed roster change
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                by{" "}
                <Link
                  href={`/players/${pendingChange.requestedBy.username}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {pendingChange.requestedBy.name}
                </Link>
                {" · "}
                {fmtDate(pendingChange.submittedAt)}
              </p>
            </div>
            <Badge variant="warning" size="sm">
              Awaiting review
            </Badge>
          </header>
          {pendingChange.message ? (
            <blockquote className="rounded-md border-l-4 border-primary/60 bg-background px-3 py-2 text-sm italic text-muted-foreground">
              &ldquo;{pendingChange.message}&rdquo;
            </blockquote>
          ) : null}
          <RosterDiffPanel
            currentPlayers={lockedRoster}
            proposedPlayers={pendingChange.proposedPlayers.map((p) => ({
              id: p.user.id,
              name: p.user.name,
              username: p.user.username,
              nationality: p.user.nationality,
              avatarUrl: p.user.avatarUrl,
            }))}
          />
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-primary/20 pt-3">
            {pendingChange.requestedBy.id === viewerId ? (
              <Button
                variant="ghost"
                size="sm"
                loading={cancelling}
                onClick={withdrawChangeRequest}
                data-testid="withdraw-roster-change"
              >
                Withdraw proposal
              </Button>
            ) : null}
            {canOrgEdit ? (
              <>
                <Button
                  variant="danger"
                  size="sm"
                  loading={deciding}
                  onClick={() => decideChangeRequest(false)}
                  data-testid="reject-roster-change"
                >
                  <X className="size-4" /> Reject
                </Button>
                <Button
                  variant="success"
                  size="sm"
                  loading={deciding}
                  onClick={() => decideChangeRequest(true)}
                  data-testid="approve-roster-change"
                >
                  <Check className="size-4" /> Approve change
                </Button>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Editor (captain or org) */}
      {mode !== "view" ? (
        <RosterEditor
          mode={mode}
          app={app}
          loading={mode === "edit-org" ? editing : proposing}
          onCancel={() => setMode("view")}
          onSubmit={async (playerIds, rosterCaptainUserId, message) => {
            try {
              if (mode === "edit-org") {
                await editRoster({
                  variables: {
                    id: app.id,
                    playerUserIds: playerIds,
                    rosterCaptainUserId: rosterCaptainUserId ?? null,
                  },
                });
                toast.success(
                  "Roster updated",
                  "The locked roster is now in sync with your edit.",
                );
              } else {
                await proposeChange({
                  variables: {
                    applicationId: app.id,
                    playerUserIds: playerIds,
                    rosterCaptainUserId: rosterCaptainUserId ?? null,
                    message: message || null,
                  },
                });
                toast.success(
                  "Proposal submitted",
                  "The organizer will review it.",
                );
              }
              setMode("view");
              await refetch();
              router.refresh();
            } catch (e) {
              toast.error(
                "Could not save",
                e instanceof Error ? e.message : "Try again.",
              );
            }
          }}
        />
      ) : null}

      {/* History of decisions on past change requests */}
      {historicalChanges.length > 0 ? (
        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Change history
          </h3>
          <ul className="space-y-2">
            {historicalChanges.map((req) => (
              <li
                key={req.id}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold">
                      {labelFor(req.status)}
                    </span>{" "}
                    proposed by{" "}
                    <Link
                      href={`/players/${req.requestedBy.username}`}
                      className="hover:underline"
                    >
                      {req.requestedBy.name}
                    </Link>{" "}
                    {fmtDate(req.submittedAt)}
                  </div>
                  {req.reviewedAt && req.reviewedBy ? (
                    <div className="text-xs text-muted-foreground">
                      Reviewed by{" "}
                      <Link
                        href={`/players/${req.reviewedBy.username}`}
                        className="hover:underline"
                      >
                        {req.reviewedBy.name}
                      </Link>{" "}
                      {fmtDate(req.reviewedAt)}
                    </div>
                  ) : null}
                </div>
                {req.reviewNote ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Note: {req.reviewNote}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

type SimplePlayer = {
  id: string;
  name: string;
  username: string;
  nationality?: string | null;
  avatarUrl?: string | null;
  tag?: string | null;
};

function PlayerGrid({ players }: { players: SimplePlayer[] }) {
  if (players.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-background px-3 py-6 text-center text-xs text-muted-foreground">
        No players in this roster.
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {players.map((p) => (
        <li
          key={p.id}
          className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
          data-testid={`roster-player-${p.id}`}
        >
          <Avatar
            size="sm"
            src={p.avatarUrl ?? undefined}
            fallback={p.name}
          />
          <div className="min-w-0 flex-1">
            <Link
              href={`/players/${p.username}`}
              className="truncate font-semibold hover:underline"
            >
              {p.name}
              <CountryFlag
                code={p.nationality}
                className="ml-1 leading-none"
              />
            </Link>
            <div className="truncate text-xs text-muted-foreground">
              @{p.username}
            </div>
          </div>
          {p.tag ? (
            <Badge variant="primary" size="sm">
              {p.tag}
            </Badge>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * Round-50 — friendly side-by-side diff for a pending roster change request.
 * Avatars + names make adds/removes legible at a glance; the panel also
 * surfaces "kept" players so the org/admin sees the full picture, not just
 * deltas. Designed for the change-review surface.
 */
function RosterDiffPanel({
  currentPlayers,
  proposedPlayers,
}: {
  currentPlayers: SimplePlayer[];
  proposedPlayers: SimplePlayer[];
}) {
  const currentSet = new Set(currentPlayers.map((p) => p.id));
  const proposedSet = new Set(proposedPlayers.map((p) => p.id));
  const removed = currentPlayers.filter((p) => !proposedSet.has(p.id));
  const added = proposedPlayers.filter((p) => !currentSet.has(p.id));
  const kept = proposedPlayers.filter((p) => currentSet.has(p.id));

  if (removed.length === 0 && added.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-background px-3 py-3 text-center text-xs text-muted-foreground">
        Same players as the current roster — no changes proposed.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <DiffColumn
        title="Removed"
        count={removed.length}
        tone="destructive"
        symbol="−"
        players={removed}
        emptyLabel="None"
      />
      <DiffColumn
        title="Added"
        count={added.length}
        tone="success"
        symbol="+"
        players={added}
        emptyLabel="None"
      />
      {kept.length > 0 ? (
        <div className="md:col-span-2">
          <details className="group rounded-md border border-border bg-background">
            <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground">
              <span>Kept ({kept.length})</span>
              <span className="text-[10px] uppercase tracking-wider group-open:hidden">
                Show
              </span>
              <span className="hidden text-[10px] uppercase tracking-wider group-open:inline">
                Hide
              </span>
            </summary>
            <ul className="divide-y divide-border">
              {kept.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 px-3 py-2 text-sm"
                >
                  <Avatar
                    size="sm"
                    src={p.avatarUrl ?? undefined}
                    fallback={p.name}
                  />
                  <span className="truncate font-medium">
                    {p.name}
                    <CountryFlag
                      code={p.nationality}
                      className="ml-1 leading-none"
                    />
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    @{p.username}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : null}
    </div>
  );
}

function DiffColumn({
  title,
  count,
  tone,
  symbol,
  players,
  emptyLabel,
}: {
  title: string;
  count: number;
  tone: "destructive" | "success";
  symbol: string;
  players: SimplePlayer[];
  emptyLabel: string;
}) {
  const toneCls =
    tone === "destructive"
      ? "border-destructive/30 bg-destructive/5 text-destructive"
      : "border-success/30 bg-success/5 text-success";
  const symbolCls =
    tone === "destructive"
      ? "bg-destructive/20 text-destructive"
      : "bg-success/20 text-success";
  return (
    <div className={`rounded-lg border ${toneCls} p-3`}>
      <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider">
        <span>{title}</span>
        <span>{count}</span>
      </div>
      {players.length === 0 ? (
        <div className="text-xs text-muted-foreground">{emptyLabel}</div>
      ) : (
        <ul className="space-y-1">
          {players.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-2 rounded-md bg-background/80 px-2 py-1.5 text-sm"
            >
              <span
                aria-hidden
                className={`inline-flex size-5 items-center justify-center rounded-full text-xs font-bold ${symbolCls}`}
              >
                {symbol}
              </span>
              <Avatar
                size="sm"
                src={p.avatarUrl ?? undefined}
                fallback={p.name}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-foreground">
                  {p.name}
                  <CountryFlag
                    code={p.nationality}
                    className="ml-1 leading-none"
                  />
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  @{p.username}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type AppDetail = NonNullable<
  ResultOf<typeof CompetitionApplicationDetailQuery>["competitionApplication"]
>;

function RosterEditor({
  mode,
  app,
  loading,
  onCancel,
  onSubmit,
}: {
  mode: "edit-org" | "edit-captain";
  app: NonNullable<AppDetail>;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (
    playerIds: string[],
    rosterCaptainUserId: string | null,
    message: string,
  ) => Promise<void>;
}) {
  const initial = useMemo(
    () => new Set(app.applicationPlayers.map((p) => p.user.id)),
    [app],
  );
  const [selected, setSelected] = useState<Set<string>>(initial);
  const [message, setMessage] = useState("");
  const [rosterCaptain, setRosterCaptain] = useState<string>(
    app.rosterCaptain?.id ?? "",
  );

  const min = app.competition.minPlayersPerTeam;
  const max = app.competition.maxPlayersPerTeam;
  const teamMembers = app.team?.members.filter((m) => m.isActive) ?? [];
  const captainInRoster = selected.has(app.team?.captain.id ?? "__none__");
  const needsRosterCaptain = !captainInRoster;
  const ready =
    selected.size >= min &&
    (max == null || selected.size <= max) &&
    (!needsRosterCaptain || (rosterCaptain && selected.has(rosterCaptain)));

  function toggle(userId: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      // If the picked roster captain just got dropped, clear it.
      if (rosterCaptain && !next.has(rosterCaptain)) {
        setRosterCaptain("");
      }
      return next;
    });
  }

  return (
    <section
      className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-4"
      data-testid={mode === "edit-org" ? "roster-editor-org" : "roster-editor-captain"}
    >
      <header>
        <h3 className="text-sm font-semibold">
          {mode === "edit-org"
            ? "Edit roster (in-place)"
            : "Propose roster change"}
        </h3>
        <p className="text-xs text-muted-foreground">
          {mode === "edit-org"
            ? "Saves immediately. Cancels any pending captain proposal."
            : "Sent to the organizer for review — current roster stays locked until they approve."}
        </p>
      </header>
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {teamMembers.map((m) => {
          const checked = selected.has(m.user.id);
          const isCaptainRow = m.user.id === app.team?.captain.id;
          return (
            <li key={m.id}>
              <label
                className={
                  "flex cursor-pointer items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm transition-colors " +
                  (checked
                    ? "border-primary/60 bg-primary/10"
                    : "border-border hover:border-primary/30")
                }
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(m.user.id)}
                  className="size-4 accent-primary"
                />
                <Avatar
                  size="sm"
                  src={m.user.avatarUrl ?? undefined}
                  fallback={m.user.name}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">
                      {m.user.name}
                      <CountryFlag
                        code={m.user.nationality}
                        className="ml-1 leading-none"
                      />
                    </span>
                    {isCaptainRow ? (
                      <Badge variant="primary" size="sm">
                        Captain
                      </Badge>
                    ) : null}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    @{m.user.username}
                  </div>
                </div>
              </label>
            </li>
          );
        })}
      </ul>

      {needsRosterCaptain ? (
        <div className="space-y-1.5">
          <Label htmlFor="roster-captain">Roster Captain</Label>
          <select
            id="roster-captain"
            value={rosterCaptain}
            onChange={(e) => setRosterCaptain(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Pick a player to act as captain…</option>
            {teamMembers
              .filter((m) => selected.has(m.user.id))
              .map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name} (@{m.user.username})
                </option>
              ))}
          </select>
          <p className="text-xs text-muted-foreground">
            The Team Captain isn&apos;t in the roster, so someone has to run
            match flow for this competition.
          </p>
        </div>
      ) : null}

      {mode === "edit-captain" ? (
        <div className="space-y-1.5">
          <Label htmlFor="change-message">Note to the organizer (optional)</Label>
          <Input
            id="change-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Why you're proposing this swap"
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <Badge
          variant={
            selected.size === 0
              ? "neutral"
              : selected.size < min || (max != null && selected.size > max)
                ? "warning"
                : "success"
          }
          size="sm"
        >
          {selected.size} selected
          {max != null ? ` / ${max} max` : ""} · {min}+ required
        </Badge>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            loading={loading}
            disabled={!ready}
            onClick={() =>
              onSubmit(
                [...selected],
                needsRosterCaptain ? rosterCaptain || null : null,
                message,
              )
            }
          >
            {mode === "edit-org" ? "Save roster" : "Submit proposal"}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4 p-6">
      <div className="h-6 w-48 animate-pulse rounded bg-secondary/60" />
      <div className="h-32 animate-pulse rounded bg-secondary/40" />
    </div>
  );
}

function fmtDate(value: string | Date | null | undefined) {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString();
}

function labelFor(status: string) {
  switch (status) {
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "CANCELLED":
      return "Cancelled";
    case "PENDING":
      return "Pending";
    default:
      return status;
  }
}
