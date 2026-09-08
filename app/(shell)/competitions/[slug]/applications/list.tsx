"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { LogOut, MoreVertical, Pencil } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CountryFlag } from "@/components/ui/country-flag";
import {
  ShellBadge,
  ShellTeamBadge,
} from "@/components/shell/shell-badge";
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
  InvitePlayersToCompetitionMutation,
  InviteTeamsToCompetitionMutation,
  ReviewApplicationMutation,
  WithdrawApplicationMutation,
} from "@/lib/graphql/operations/competition-mutations.operations";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { BallMark } from "@/components/layout/sidebar-icons";
import { ApplicationThread } from "@/components/competition/application-thread";
import { InviteTeamsModal } from "./invite-teams-modal";
import { InvitePlayersModal } from "./invite-players-modal";
import { AddPlaceholderModal } from "@/components/shell/add-placeholder";
import { errorText } from "@/lib/apollo/error-message";

/**
 * Round-60 — Figma "Applications" tab (node 299:9506).
 *
 * Three sectioned tables instead of grouped status cards:
 *   • Confirmed Teams / Players (APPROVED)
 *   • Applied        (PENDING / WAITLISTED) — each row gets Accept/Reject
 *   • Invited        (INVITED) — section header carries the "Invite More"
 *                                CTA; rows show when they were invited
 * Columns: Team · Captain / Roster Captain · Home Venue · Roster — a Singles
 * (INDIVIDUAL) competition has no teams and no rosters, so it collapses to
 * Player · Entered.
 * A compact "Declined / Withdrawn" table tails the page for REJECTED /
 * CANCELLED so the organizer keeps an audit trail without the clutter.
 */
export function ApplicationsList({
  slug,
  canManage = false,
}: {
  slug: string;
  /** Round-60 — non-managers (public / other teams) see a read-only
   *  Confirmed list; managers get the review + invite tables. */
  canManage?: boolean;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
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
  const [reinvitePlayer, { loading: reinvitingPlayer }] = useMutation(
    InvitePlayersToCompetitionMutation,
  );
  const [withdraw, { loading: withdrawing }] = useMutation(
    WithdrawApplicationMutation,
  );

  const competition = data?.competition;
  // Round-76 — a Singles (INDIVIDUAL) competition has no teams: entrants are
  // players, so the whole tab swaps its nouns and its invite path.
  const isIndividual = competition?.type === "INDIVIDUAL";
  const entrantWord = isIndividual ? "players" : "teams";
  const competitionId = competition?.id ?? "";
  const competitionName = competition?.name ?? undefined;
  const organizerName = competition?.organizer?.name ?? undefined;
  const maxTeams = competition?.maxTeams ?? null;
  const applications = competition?.applications ?? [];

  const confirmed = applications.filter((a) => a.status === "APPROVED");
  // Round-88 — teams a placeholder player can be added to: anything already
  // entered (approved or still under review), deduped by team id.
  const enteredTeams = Array.from(
    new Map(
      applications
        .filter(
          (a) =>
            a.team &&
            (a.status === "APPROVED" ||
              a.status === "PENDING" ||
              a.status === "WAITLISTED"),
        )
        .map((a) => [a.team!.id, { id: a.team!.id, name: a.team!.name }]),
    ).values(),
  );
  // Round-88 — sits next to Invite: same question ("get this person into my
  // competition"), two answers depending on whether they're on PoolDN.
  const placeholderButton =
    canManage && competitionId ? (
      <AddPlaceholderModal
        competitionId={competitionId}
        isIndividual={isIndividual}
        teams={enteredTeams}
        // The dialog refreshes the route itself on close; this just re-runs
        // the tab's own query so the tables update in the same pass.
        onCreated={() => {
          void refetch();
        }}
      />
    ) : null;
  const applied = applications.filter(
    (a) => a.status === "PENDING" || a.status === "WAITLISTED",
  );
  const invited = applications.filter((a) => a.status === "INVITED");

  // Both invite mutations skip PENDING/APPROVED/WAITLISTED server-side —
  // mirror that here so the modal disables those checkboxes up-front.
  const engaged = applications.filter(
    (a) =>
      a.status === "PENDING" ||
      a.status === "APPROVED" ||
      a.status === "WAITLISTED",
  );
  const engagedTeamIds = new Set(
    engaged.map((a) => a.team?.id).filter((id): id is string => Boolean(id)),
  );
  const engagedUserIds = new Set(
    engaged
      .map((a) => a.applicant?.id)
      .filter((id): id is string => Boolean(id)),
  );

  /** Picks the team or player invite dialog for this competition's type.
   *  A plain render function, not a component — a component declared during
   *  render gets a fresh identity each pass and would remount the dialog,
   *  wiping the organizer's search text and checkbox selection mid-invite. */
  function inviteModal(triggerLabel: string) {
    if (!competitionId) return null;
    return isIndividual ? (
      <InvitePlayersModal
        competitionId={competitionId}
        excludeUserIds={engagedUserIds}
        onInvited={() => refetch()}
        triggerLabel={triggerLabel}
      />
    ) : (
      <InviteTeamsModal
        competitionId={competitionId}
        excludeTeamIds={engagedTeamIds}
        onInvited={() => refetch()}
        triggerLabel={triggerLabel}
      />
    );
  }

  async function decide(applicationId: string, approve: boolean) {
    await review({ variables: { input: { applicationId, approve } } });
    await refetch();
  }

  /** `id` is a teamId for team formats, a userId for Singles. */
  async function reinviteOne(id: string) {
    try {
      if (isIndividual) {
        await reinvitePlayer({
          variables: { competitionId, userIds: [id], personalNote: null },
        });
      } else {
        await reinvite({
          variables: { competitionId, teamIds: [id], personalNote: null },
        });
      }
      toast.success("Invite re-sent");
      await refetch();
    } catch (e) {
      toast.error(
        "Couldn't re-send invite",
        errorText(e, "Try again."),
      );
    }
  }

  // Organizer removes a confirmed team / cancels an invite, or an invited
  // captain declines their own invitation — all withdrawApplication under the
  // hood, differing only in the confirm copy + success toast.
  // Round-76 — the entrant is a team or a single player; the confirm copy
  // follows whichever this competition uses.
  const REMOVE_COPY = {
    confirmed: {
      title: (n: string) => `Remove ${n}?`,
      description: isIndividual
        ? "The player is removed from the competition. They can be invited or re-enter later."
        : "The team is removed from the competition and its roster slots are freed. They can be invited or re-apply later.",
      confirmLabel: isIndividual ? "Remove player" : "Remove team",
      success: isIndividual ? "Player removed" : "Team removed",
    },
    invite: {
      title: (n: string) => `Cancel invite to ${n}?`,
      description: "The pending invitation is withdrawn.",
      confirmLabel: "Cancel invite",
      success: "Invitation cancelled",
    },
    decline: {
      title: () => "Decline this invitation?",
      description: isIndividual
        ? "You won't join this competition. The organizer can invite you again later."
        : "Your team won't join this competition. The organizer can invite you again later.",
      confirmLabel: "Decline invite",
      success: "Invitation declined",
    },
    withdraw: {
      title: (n: string) =>
        isIndividual ? "Cancel your application?" : `Withdraw ${n}?`,
      description: isIndividual
        ? "You're removed from this competition. You can enter again later."
        : "Your team is removed from this competition and any locked roster slots are freed. You can re-apply later.",
      confirmLabel: isIndividual ? "Cancel application" : "Withdraw",
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
      // The hero (entrant count + Apply/Enter CTA) is server-rendered in the
      // layout, so refetching this tab's query alone leaves it showing the
      // entry that was just removed.
      router.refresh();
    } catch (e) {
      toast.error(
        "Couldn't complete that",
        errorText(e, "Try again."),
      );
    }
  }

  // Round-62 — the viewer's own outstanding invite. Round-76 — a Singles
  // invite has no team, so match the solo applicant as well; without this an
  // invited player saw no card at all on this tab.
  const isMine = (a: (typeof applications)[number]) =>
    !!viewer &&
    (a.team?.captain?.id === viewer.id || a.applicant?.id === viewer.id);

  const myInvite = viewer ? invited.find(isMine) ?? null : null;

  // The viewer's own live application. Drives the application card with
  // withdraw (+ edit-roster on team formats).
  const myApplication = viewer
    ? applications.find(
        (a) =>
          isMine(a) &&
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
                myInvite.team?.name ?? myInvite.applicant?.name ?? "you",
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
                myApplication.team?.name ??
                  myApplication.applicant?.name ??
                  "you",
                "withdraw",
              )
            }
            withdrawing={withdrawing}
            organizerName={organizerName}
          />
        ) : null}
        {confirmed.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
            <BallMark className="size-14 text-primary drop-shadow-[0_0_16px_rgba(208,243,13,0.5)]" />
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">
                No {entrantWord} confirmed yet
              </h2>
              <p className="text-sm text-muted-foreground">
                {isIndividual
                  ? "Be the first — enter this competition."
                  : "Be the first — apply with your team."}
              </p>
            </div>
          </div>
        ) : (
          <Section
            title={isIndividual ? "Confirmed Players" : "Confirmed Teams"}
            count={confirmed.length}
            capacity={maxTeams}
          >
            <AppTable
              isIndividual={isIndividual}
              rows={confirmed}
              lastColLabel={isIndividual ? "Entered" : "Roster"}
              renderLast={(app) =>
                isIndividual ? <EnteredCell app={app} /> : <RosterCell app={app} />
              }
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
        {/* Round-88 — an organizer whose players aren't on PoolDN yet
            shouldn't dead-end at "invite someone with an account". */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {inviteModal("Invite")}
          {placeholderButton}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Confirmed Teams — approved by the organizer */}
      {confirmed.length > 0 ? (
        <Section
          title={isIndividual ? "Confirmed Players" : "Confirmed Teams"}
          count={confirmed.length}
          capacity={maxTeams}
        >
          <AppTable
            isIndividual={isIndividual}
            rows={confirmed}
            lastColLabel={isIndividual ? "Entered" : "Roster"}
            renderLast={(app) =>
              isIndividual ? <EnteredCell app={app} /> : <RosterCell app={app} />
            }
            renderAction={(app) => {
              const entrantName = app.team?.name ?? app.applicant?.name;
              if (!entrantName) return null;
              return (
                <div className="flex items-center justify-end gap-2">
                  {app.team ? (
                    <ApplicationDetailDialog
                      applicationId={app.id}
                      teamName={app.team.name}
                      competitionName={competitionName}
                      viewerId={viewer?.id ?? null}
                      viewerRole={viewer?.role ?? null}
                      triggerLabel="View"
                    />
                  ) : null}
                  <ApplicationThread
                    applicationId={app.id}
                    counterpartName={entrantName}
                    competitionName={competitionName}
                    unreadCount={app.unreadMessageCount ?? 0}
                    triggerVariant="ghost"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={withdrawing}
                    onClick={() => removeEntry(app.id, entrantName, "confirmed")}
                    data-testid={`remove-team-${app.id}`}
                  >
                    Remove
                  </Button>
                </div>
              );
            }}
          />
        </Section>
      ) : null}

      {/* Applied — teams awaiting the organizer's decision (PENDING /
          WAITLISTED). Shown for every competition, including invite-only
          ones where invited teams accept and land here for approval. */}
      {applied.length > 0 ? (
        <Section title="Applied" count={applied.length}>
          <AppTable
            isIndividual={isIndividual}
            rows={applied}
            lastColLabel={isIndividual ? "Entered" : "Roster"}
            renderLast={(app) =>
              isIndividual ? <EnteredCell app={app} /> : <RosterCell app={app} />
            }
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
                {/* Round-77 — the applicant's note from the apply form lives
                    here; without it the organizer had no way to read it. */}
                <ApplicationThread
                  applicationId={app.id}
                  counterpartName={app.team?.name ?? app.applicant?.name}
                  competitionName={competitionName}
                  unreadCount={app.unreadMessageCount ?? 0}
                  triggerVariant="ghost"
                />
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
          <div className="flex flex-wrap items-center gap-2">
            {inviteModal("Invite More")}
            {placeholderButton}
          </div>
        }
      >
        {invited.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No outstanding invites. Use “Invite More” to invite {entrantWord}{" "}
            directly.
          </p>
        ) : (
          <AppTable
            isIndividual={isIndividual}
            rows={invited}
            lastColLabel="Invited"
            renderLast={(app) => (
              <span className="text-xs text-muted-foreground">
                <LocalDateTime value={app.submittedAt} variant="date" />
              </span>
            )}
            renderAction={(app) => {
              // Round-76 — a Singles invite is keyed on the applicant, not a
              // team; without this the solo rows rendered no actions at all.
              const targetId = app.team?.id ?? app.applicant?.id;
              const targetName = app.team?.name ?? app.applicant?.name;
              if (!targetId || !targetName) return null;
              return (
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={reinviting || reinvitingPlayer}
                    onClick={() => reinviteOne(targetId)}
                  >
                    Re-invite
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={withdrawing}
                    onClick={() => removeEntry(app.id, targetName, "invite")}
                    data-testid={`cancel-invite-${app.id}`}
                  >
                    Cancel
                  </Button>
                </div>
              );
            }}
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
    /** Round-88 — a placeholder team the organizer entered themselves. */
    isShell?: boolean;
    shellMemberCount?: number;
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
  /** Round-77 — thread totals. The badge shows unread; messageCount is the
   *  full count, kept for anything that wants "does a thread exist". */
  messageCount?: number;
  unreadMessageCount?: number;
  applicant?: {
    id: string;
    /** Round-88 — a Singles entrant that is still a placeholder profile. */
    isShell?: boolean;
    name: string;
    username: string;
    avatarUrl?: string | null;
    nationality?: string | null;
  } | null;
};

function AppTable({
  rows,
  lastColLabel,
  renderLast,
  renderAction,
  isIndividual = false,
}: {
  rows: AnyApp[];
  lastColLabel: string;
  renderLast: (app: AnyApp) => React.ReactNode;
  renderAction?: (app: AnyApp) => React.ReactNode;
  /** Round-76 — Singles entrants have no captain and no home venue, so those
   *  two columns are dropped rather than rendered as "Solo registration"/"—". */
  isIndividual?: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{isIndividual ? "Player" : "Team / Player"}</TableHead>
          {isIndividual ? null : (
            <>
              <TableHead>Captain / Roster Captain</TableHead>
              <TableHead>Home Venue</TableHead>
            </>
          )}
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
                    ghost={!app.team && (app.applicant?.isShell ?? false)}
                  />
                  {name}
                </Link>
                {app.team?.isShell ? (
                  <ShellTeamBadge
                    className="ml-2 align-middle"
                    unclaimedCount={app.team.shellMemberCount ?? undefined}
                  />
                ) : app.applicant?.isShell ? (
                  <ShellBadge className="ml-2 align-middle" />
                ) : null}
              </TableCell>
              {isIndividual ? null : (
                <>
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
                </>
              )}
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
  // Round-76 — a Singles invite is addressed to the player: no team logo, no
  // captain line, no home venue, and Accept goes to the solo apply form
  // (which /apply already picks by competition type).
  const team = app.team;
  const player = app.applicant;
  if (!team && !player) return null;
  const name = team?.name ?? player!.name;
  const acceptHref = team
    ? `/competitions/${slug}/apply?teamId=${team.id}`
    : `/competitions/${slug}/apply`;
  return (
    <section
      className="rounded-2xl border border-primary/40 bg-primary/5 p-5"
      data-testid="competition-invite-card"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar
            size="lg"
            src={(team?.logoUrl ?? player?.avatarUrl) ?? undefined}
            fallback={name}
            shape={team ? "team" : "user"}
          />
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">
              You&rsquo;re invited
            </div>
            <div className="truncate text-lg font-semibold">{name}</div>
            {team ? (
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
            ) : (
              <div className="text-sm text-muted-foreground">
                @{player!.username}
                <CountryFlag
                  code={player!.nationality}
                  className="ml-1 leading-none"
                />
              </div>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              {team
                ? competitionName
                  ? `${competitionName} invited your team to join.`
                  : "Your team has been invited to join this competition."
                : competitionName
                  ? `${competitionName} invited you to play.`
                  : "You've been invited to play in this competition."}
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
          <Link href={acceptHref}>
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
  organizerName,
}: {
  app: AnyApp;
  competitionName?: string;
  viewerId: string | null;
  viewerRole: string | null;
  onWithdraw: () => void;
  withdrawing: boolean;
  /** Round-77 — who the applicant is talking to in the message thread. */
  organizerName?: string;
}) {
  const team = app.team;
  // Round-76 — Singles entrants apply as themselves. There's no roster to
  // edit, so the kebab carries a single "Cancel my application" item.
  const player = app.applicant;
  // Drives the detail sheet from the kebab item (controlled open).
  const [detailOpen, setDetailOpen] = useState(false);
  if (!team && !player) return null;
  const name = team?.name ?? player!.name;
  const blurb =
    app.status === "APPROVED"
      ? team
        ? "Your team is confirmed for this competition."
        : "You're confirmed for this competition."
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
            src={(team?.logoUrl ?? player?.avatarUrl) ?? undefined}
            fallback={name}
            shape={team ? "team" : "user"}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-lg font-semibold">{name}</span>
              <ApplicationStatusChip status={app.status as ApplicationStatus} />
            </div>
            {team ? (
              <div className="text-sm text-muted-foreground">
                {team.captain.name}
                <CountryFlag
                  code={team.captain.nationality}
                  className="ml-1 leading-none"
                />
                {team.homeVenue ? <span> · {team.homeVenue.name}</span> : null}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                @{player!.username}
                <CountryFlag
                  code={player!.nationality}
                  className="ml-1 leading-none"
                />
              </div>
            )}
            <p className="mt-1 text-sm text-muted-foreground">{blurb}</p>
          </div>
        </div>
        {/* Actions live under a kebab so Withdraw / Edit can't be clicked by
            accident. The Edit item drives the detail sheet (controlled). */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Round-77 — the applicant's side of the conversation. Their note
              from the apply form is the first message in here. */}
          <ApplicationThread
            applicationId={app.id}
            counterpartName={organizerName ?? "the organizer"}
            competitionName={competitionName}
            unreadCount={app.unreadMessageCount ?? 0}
          />
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
              {team ? (
                <>
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
                </>
              ) : null}
              <DropdownMenuItem
                variant="danger"
                onClick={onWithdraw}
                data-testid="application-withdraw"
              >
                <LogOut className="size-4" />
                <span>{team ? "Withdraw" : "Cancel my application"}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {team ? (
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
          ) : null}
        </div>
      </div>
    </section>
  );
}

/**
 * Round-77 — Singles entrants have no roster, so the last column shows when
 * they entered instead of a "0 players" count that could never be anything
 * else.
 */
function EnteredCell({ app }: { app: AnyApp }) {
  return (
    <span className="text-xs text-muted-foreground">
      <LocalDateTime value={app.submittedAt} variant="date" />
    </span>
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
