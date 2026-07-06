"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { LogOut, MoreVertical, Pencil } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CountryFlag } from "@/components/ui/country-flag";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { ApplicationDetailDialog } from "@/components/competition/application-detail-dialog";
import { ApplicationStatusChip } from "@/components/ui/status-chip";
import type { ApplicationStatus } from "@/lib/generated/prisma/enums";
import { LocalDateTime } from "@/components/ui/local-datetime";
import {
  CompetitionApplicationsQuery,
  ViewerQuery,
} from "@/lib/graphql/operations/competition.operations";
import {
  InviteTeamsToCompetitionMutation,
  ReviewApplicationMutation,
  WithdrawApplicationMutation,
} from "@/lib/graphql/operations/competition-mutations.operations";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { BallMark } from "@/components/layout/sidebar-icons";
import { InviteTeamsModal } from "./invite-teams-modal";

/**
 * Round-60 — Figma "Applications" tab (node 299:9506).
 *
 * Three sectioned tables instead of grouped status cards:
 *   • Confirmed Teams (APPROVED)
 *   • Applied        (PENDING / WAITLISTED) — each row gets Accept/Reject
 *   • Invited        (INVITED) — section header carries the "Invite More"
 *                                CTA; rows show when they were invited
 * Columns: Team · Captain / Roster Captain · Home Venue · Roster.
 * A compact "Declined / Withdrawn" table tails the page for REJECTED /
 * CANCELLED so the organizer keeps an audit trail without the clutter.
 */
export function ApplicationsList({
  slug,
  canManage = false,
}: {
  slug: string;
  /** Round-60 — non-managers (public / other teams) see a read-only
   *  Confirmed Teams list; managers get the review + invite tables. */
  canManage?: boolean;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data, refetch, loading: loadingApps } = useQuery(
    CompetitionApplicationsQuery,
    { variables: { slug } },
  );
  const { data: viewerData } = useQuery(ViewerQuery, {
    errorPolicy: "ignore",
    fetchPolicy: "cache-first",
  });
  const viewer = viewerData?.viewer ?? null;
  const [review, { loading }] = useMutation(ReviewApplicationMutation);
  const [reinvite, { loading: reinviting }] = useMutation(
    InviteTeamsToCompetitionMutation,
  );
  const [withdraw, { loading: withdrawing }] = useMutation(
    WithdrawApplicationMutation,
  );

  const competition = data?.competition;
  const competitionId = competition?.id ?? "";
  const competitionName = competition?.name ?? undefined;
  const maxTeams = competition?.maxTeams ?? null;
  const applications = competition?.applications ?? [];

  const confirmed = applications.filter((a) => a.status === "APPROVED");
  const applied = applications.filter(
    (a) => a.status === "PENDING" || a.status === "WAITLISTED",
  );
  const invited = applications.filter((a) => a.status === "INVITED");

  // Server-side inviteTeamsToCompetition skips PENDING/APPROVED/WAITLISTED —
  // mirror that here so the modal disables those checkboxes up-front.
  const engagedTeamIds = new Set(
    applications
      .filter(
        (a) =>
          a.status === "PENDING" ||
          a.status === "APPROVED" ||
          a.status === "WAITLISTED",
      )
      .map((a) => a.team?.id)
      .filter((id): id is string => Boolean(id)),
  );

  async function decide(applicationId: string, approve: boolean) {
    await review({ variables: { input: { applicationId, approve } } });
    await refetch();
  }

  async function reinviteOne(teamId: string) {
    try {
      await reinvite({
        variables: { competitionId, teamIds: [teamId], personalNote: null },
      });
      toast.success("Invite re-sent");
      await refetch();
    } catch (e) {
      toast.error(
        "Couldn't re-send invite",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  // Organizer removes a confirmed team / cancels an invite, or an invited
  // captain declines their own invitation — all withdrawApplication under the
  // hood, differing only in the confirm copy + success toast.
  const REMOVE_COPY = {
    confirmed: {
      title: (n: string) => `Remove ${n}?`,
      description:
        "The team is removed from the competition and its roster slots are freed. They can be invited or re-apply later.",
      confirmLabel: "Remove team",
      success: "Team removed",
    },
    invite: {
      title: (n: string) => `Cancel invite to ${n}?`,
      description: "The pending invitation is withdrawn.",
      confirmLabel: "Cancel invite",
      success: "Invitation cancelled",
    },
    decline: {
      title: () => "Decline this invitation?",
      description:
        "Your team won't join this competition. The organizer can invite you again later.",
      confirmLabel: "Decline invite",
      success: "Invitation declined",
    },
    withdraw: {
      title: (n: string) => `Withdraw ${n}?`,
      description:
        "Your team is removed from this competition and any locked roster slots are freed. You can re-apply later.",
      confirmLabel: "Withdraw",
      success: "Application withdrawn",
    },
  } as const;

  async function removeEntry(
    applicationId: string,
    teamName: string,
    kind: "confirmed" | "invite" | "decline" | "withdraw",
  ) {
    const c = REMOVE_COPY[kind];
    const ok = await confirm({
      title: c.title(teamName),
      description: c.description,
      confirmLabel: c.confirmLabel,
      destructive: true,
    });
    if (!ok) return;
    try {
      await withdraw({ variables: { id: applicationId } });
      toast.success(c.success);
      await refetch();
    } catch (e) {
      toast.error(
        "Couldn't complete that",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  // Round-62 — the viewer's own outstanding invite (a captain whose team was
  // invited). Drives the invite card shown on this tab.
  const myInvite = viewer
    ? invited.find((a) => a.team?.captain?.id === viewer.id) ?? null
    : null;

  // The viewer's own live application (a captain whose team applied / is
  // confirmed). Drives the application card with withdraw + edit-roster.
  const myApplication = viewer
    ? applications.find(
        (a) =>
          a.team?.captain?.id === viewer.id &&
          (a.status === "PENDING" ||
            a.status === "WAITLISTED" ||
            a.status === "APPROVED"),
      ) ?? null
    : null;

  // First load — avoid flashing the empty-state placeholder before the
  // applications query resolves (the list is client-rendered, so `data`
  // is undefined on the initial paint).
  if (loadingApps && !data) {
    return (
      <div className="space-y-3" data-testid="applications-loading">
        <div className="h-6 w-40 animate-pulse rounded bg-secondary/60" />
        <div className="h-32 w-full animate-pulse rounded-xl bg-secondary/40" />
      </div>
    );
  }

  // Round-60/62 — non-managers (public / other captains) see who's confirmed,
  // plus — if the viewer's own team was invited — an invite card at the top.
  // The review/invite tooling stays organizer-only.
  if (!canManage) {
    return (
      <div className="space-y-8">
        {myInvite ? (
          <InviteCard
            app={myInvite}
            slug={slug}
            competitionName={competitionName}
            onDecline={() =>
              removeEntry(
                myInvite.id,
                myInvite.team?.name ?? "your team",
                "decline",
              )
            }
            declining={withdrawing}
          />
        ) : null}
        {myApplication ? (
          <ApplicationCard
            app={myApplication}
            competitionName={competitionName}
            viewerId={viewer?.id ?? null}
            viewerRole={viewer?.role ?? null}
            onWithdraw={() =>
              removeEntry(
                myApplication.id,
                myApplication.team?.name ?? "your team",
                "withdraw",
              )
            }
            withdrawing={withdrawing}
          />
        ) : null}
        {confirmed.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
            <BallMark className="size-14 text-primary drop-shadow-[0_0_16px_rgba(208,243,13,0.5)]" />
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">No teams confirmed yet</h2>
              <p className="text-sm text-muted-foreground">
                Be the first — apply with your team.
              </p>
            </div>
          </div>
        ) : (
          <Section
            title="Confirmed Teams"
            count={confirmed.length}
            capacity={maxTeams}
          >
            <AppTable
              rows={confirmed}
              lastColLabel="Roster"
              renderLast={(app) => <RosterCell app={app} />}
            />
          </Section>
        )}
      </div>
    );
  }

  // Round-60 — Figma empty state (node 195:4979): a centered placeholder
  // card with the brand 8-ball mark, "Competition Created!" copy, and an
  // Invite CTA. Shown to the organizer when nothing's happened yet.
  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
        <BallMark className="size-14 text-primary drop-shadow-[0_0_16px_rgba(208,243,13,0.5)]" />
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Competition Created!</h2>
          <p className="text-sm text-muted-foreground">
            Time to start inviting participants
          </p>
        </div>
        {competitionId ? (
          <InviteTeamsModal
            competitionId={competitionId}
            excludeTeamIds={engagedTeamIds}
            onInvited={() => refetch()}
            triggerLabel="Invite"
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Confirmed Teams — approved by the organizer */}
      {confirmed.length > 0 ? (
        <Section
          title="Confirmed Teams"
          count={confirmed.length}
          capacity={maxTeams}
        >
          <AppTable
            rows={confirmed}
            lastColLabel="Roster"
            renderLast={(app) => <RosterCell app={app} />}
            renderAction={(app) =>
              app.team ? (
                <div className="flex items-center justify-end gap-2">
                  <ApplicationDetailDialog
                    applicationId={app.id}
                    teamName={app.team.name}
                    competitionName={competitionName}
                    viewerId={viewer?.id ?? null}
                    viewerRole={viewer?.role ?? null}
                    triggerLabel="View"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={withdrawing}
                    onClick={() =>
                      removeEntry(app.id, app.team!.name, "confirmed")
                    }
                    data-testid={`remove-team-${app.id}`}
                  >
                    Remove
                  </Button>
                </div>
              ) : null
            }
          />
        </Section>
      ) : null}

      {/* Applied — teams awaiting the organizer's decision (PENDING /
          WAITLISTED). Shown for every competition, including invite-only
          ones where invited teams accept and land here for approval. */}
      {applied.length > 0 ? (
        <Section title="Applied" count={applied.length}>
          <AppTable
            rows={applied}
            lastColLabel="Roster"
            renderLast={(app) => <RosterCell app={app} />}
            renderAction={(app) => (
              <div className="flex items-center justify-end gap-2">
                {app.team ? (
                  <ApplicationDetailDialog
                    applicationId={app.id}
                    teamName={app.team.name}
                    competitionName={competitionName}
                    viewerId={viewer?.id ?? null}
                    viewerRole={viewer?.role ?? null}
                    triggerLabel="Review"
                  />
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  loading={loading}
                  onClick={() => decide(app.id, false)}
                  data-testid={`quick-reject-${app.id}`}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  loading={loading}
                  onClick={() => decide(app.id, true)}
                  data-testid={`quick-approve-${app.id}`}
                >
                  Accept
                </Button>
              </div>
            )}
          />
        </Section>
      ) : null}

      {/* Invited — invited teams + Invite More CTA */}
      <Section
        title="Invited"
        count={invited.length}
        action={
          competitionId ? (
            <InviteTeamsModal
              competitionId={competitionId}
              excludeTeamIds={engagedTeamIds}
              onInvited={() => refetch()}
              triggerLabel="Invite More"
            />
          ) : null
        }
      >
        {invited.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No outstanding invites. Use “Invite More” to invite teams directly.
          </p>
        ) : (
          <AppTable
            rows={invited}
            lastColLabel="Invited"
            renderLast={(app) => (
              <span className="text-xs text-muted-foreground">
                <LocalDateTime value={app.submittedAt} variant="date" />
              </span>
            )}
            renderAction={(app) =>
              app.team ? (
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={reinviting}
                    onClick={() => reinviteOne(app.team!.id)}
                  >
                    Re-invite
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={withdrawing}
                    onClick={() => removeEntry(app.id, app.team!.name, "invite")}
                    data-testid={`cancel-invite-${app.id}`}
                  >
                    Cancel
                  </Button>
                </div>
              ) : null
            }
          />
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  capacity,
  action,
  children,
}: {
  title: string;
  count: number;
  capacity?: number | null;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3" data-testid={`apps-section-${title}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-baseline gap-2 text-sm font-semibold">
          {title}
          <span className="text-xs font-normal text-muted-foreground">
            {count}
            {capacity ? ` / ${capacity}` : ""}
          </span>
        </h2>
        {action}
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        {children}
      </div>
    </section>
  );
}

type AnyApp = {
  id: string;
  status: string;
  submittedAt: string;
  team?: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
    captain: {
      id: string;
      name: string;
      username: string;
      nationality?: string | null;
    };
    homeVenue?: { id: string; name: string } | null;
    members: Array<{ id: string }>;
  } | null;
  rosterCaptain?: {
    id: string;
    name: string;
    username: string;
    nationality?: string | null;
  } | null;
  applicationPlayers: Array<{ id: string }>;
  applicant?: {
    id: string;
    name: string;
    username: string;
    avatarUrl?: string | null;
  } | null;
};

function AppTable({
  rows,
  lastColLabel,
  renderLast,
  renderAction,
}: {
  rows: AnyApp[];
  lastColLabel: string;
  renderLast: (app: AnyApp) => React.ReactNode;
  renderAction?: (app: AnyApp) => React.ReactNode;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Team / Player</TableHead>
          <TableHead>Captain / Roster Captain</TableHead>
          <TableHead>Home Venue</TableHead>
          <TableHead>{lastColLabel}</TableHead>
          {renderAction ? <TableHead className="text-right" /> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((app) => {
          const name = app.team?.name ?? app.applicant?.name ?? "Unknown";
          const logo = app.team?.logoUrl ?? app.applicant?.avatarUrl;
          const href = app.team
            ? `/teams/${app.team.slug}`
            : app.applicant
              ? `/players/${app.applicant.username}`
              : "#";
          return (
            <TableRow key={app.id}>
              <TableCell>
                <Link
                  href={href}
                  className="inline-flex items-center gap-2.5 font-medium hover:underline"
                >
                  <Avatar
                    size="sm"
                    src={logo ?? undefined}
                    fallback={name}
                    shape={app.team ? "team" : "user"}
                  />
                  {name}
                </Link>
              </TableCell>
              <TableCell>
                {app.team ? (
                  <div className="text-sm">
                    <Link
                      href={`/players/${app.team.captain.username}`}
                      className="hover:underline"
                    >
                      {app.team.captain.name}
                      <CountryFlag
                        code={app.team.captain.nationality}
                        className="ml-1 leading-none"
                      />
                    </Link>
                    {app.rosterCaptain &&
                    app.rosterCaptain.id !== app.team.captain.id ? (
                      <div className="text-xs text-muted-foreground">
                        Roster: {app.rosterCaptain.name}
                        <CountryFlag
                          code={app.rosterCaptain.nationality}
                          className="ml-1 leading-none"
                        />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Solo registration
                  </span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {app.team?.homeVenue?.name ?? "—"}
              </TableCell>
              <TableCell>{renderLast(app)}</TableCell>
              {renderAction ? (
                <TableCell className="text-right">
                  {renderAction(app)}
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// Round-62 — the invite card a captain sees on the Applications tab when
// their team has an outstanding invitation. Shows the invited team and the
// accept / decline actions. The team is fixed (the invite was sent to it),
// so Accept lands on the apply form pre-locked to this team.
function InviteCard({
  app,
  slug,
  competitionName,
  onDecline,
  declining,
}: {
  app: AnyApp;
  slug: string;
  competitionName?: string;
  onDecline: () => void;
  declining: boolean;
}) {
  const team = app.team;
  if (!team) return null;
  return (
    <section
      className="rounded-2xl border border-primary/40 bg-primary/5 p-5"
      data-testid="competition-invite-card"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar
            size="lg"
            src={team.logoUrl ?? undefined}
            fallback={team.name}
            shape="team"
          />
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">
              You&rsquo;re invited
            </div>
            <div className="truncate text-lg font-semibold">{team.name}</div>
            <div className="text-sm text-muted-foreground">
              {team.captain.name}
              <CountryFlag
                code={team.captain.nationality}
                className="ml-1 leading-none"
              />
              {team.homeVenue ? (
                <span> · {team.homeVenue.name}</span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {competitionName
                ? `${competitionName} invited your team to join.`
                : "Your team has been invited to join this competition."}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            loading={declining}
            onClick={onDecline}
            data-testid="invite-decline"
          >
            Decline
          </Button>
          <Link href={`/competitions/${slug}/apply?teamId=${team.id}`}>
            <Button variant="primary" data-testid="invite-accept">
              Accept invitation
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

// Round-62 — the application card a captain sees on the Applications tab once
// their team has applied (PENDING/WAITLISTED) or been confirmed (APPROVED).
// Mirrors the invite card; offers withdraw + edit-roster (the latter opens the
// detail sheet, which edits in-place while PENDING/WAITLISTED and proposes a
// change once APPROVED).
function ApplicationCard({
  app,
  competitionName,
  viewerId,
  viewerRole,
  onWithdraw,
  withdrawing,
}: {
  app: AnyApp;
  competitionName?: string;
  viewerId: string | null;
  viewerRole: string | null;
  onWithdraw: () => void;
  withdrawing: boolean;
}) {
  const team = app.team;
  // Drives the detail sheet from the kebab item (controlled open).
  const [detailOpen, setDetailOpen] = useState(false);
  if (!team) return null;
  const blurb =
    app.status === "APPROVED"
      ? "Your team is confirmed for this competition."
      : app.status === "WAITLISTED"
        ? "Your application is waitlisted — the organizer may still approve it."
        : "Your application is in — waiting on the organizer's decision.";
  const editLabel = app.status === "APPROVED" ? "Manage roster" : "Edit roster";
  return (
    <section
      className="rounded-2xl border border-border bg-card p-5"
      data-testid="competition-application-card"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar
            size="lg"
            src={team.logoUrl ?? undefined}
            fallback={team.name}
            shape="team"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-lg font-semibold">
                {team.name}
              </span>
              <ApplicationStatusChip status={app.status as ApplicationStatus} />
            </div>
            <div className="text-sm text-muted-foreground">
              {team.captain.name}
              <CountryFlag
                code={team.captain.nationality}
                className="ml-1 leading-none"
              />
              {team.homeVenue ? <span> · {team.homeVenue.name}</span> : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{blurb}</p>
          </div>
        </div>
        {/* Actions live under a kebab so Withdraw / Edit can't be clicked by
            accident. The Edit item drives the detail sheet (controlled). */}
        <div className="flex shrink-0 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Application actions"
              disabled={withdrawing}
              data-testid="application-actions-menu"
              className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-secondary/40 hover:bg-secondary"
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                // Defer opening the sheet until the menu has closed so its
                // focus teardown doesn't immediately dismiss the sheet.
                onClick={() => setTimeout(() => setDetailOpen(true), 0)}
                data-testid="application-edit-roster"
              >
                <Pencil className="size-4" />
                <span>{editLabel}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="danger"
                onClick={onWithdraw}
                data-testid="application-withdraw"
              >
                <LogOut className="size-4" />
                <span>Withdraw</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ApplicationDetailDialog
            applicationId={app.id}
            teamName={team.name}
            competitionName={competitionName}
            viewerId={viewerId}
            viewerRole={viewerRole}
            triggerLabel={null}
            open={detailOpen}
            onOpenChange={setDetailOpen}
          />
        </div>
      </div>
    </section>
  );
}

function RosterCell({ app }: { app: AnyApp }) {
  // Prefer the submitted application roster; fall back to the team's member
  // count so a not-yet-finalised application still reads sensibly.
  const count =
    app.applicationPlayers.length > 0
      ? app.applicationPlayers.length
      : (app.team?.members.length ?? 0);
  return (
    <span className="text-sm text-muted-foreground">
      {count} player{count === 1 ? "" : "s"}
    </span>
  );
}
