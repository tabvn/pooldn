"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
import { LocalDateTime } from "@/components/ui/local-datetime";
import {
  CompetitionApplicationsQuery,
  ViewerQuery,
} from "@/lib/graphql/operations/competition.operations";
import {
  InviteTeamsToCompetitionMutation,
  ReviewApplicationMutation,
} from "@/lib/graphql/operations/competition-mutations.operations";
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
export function ApplicationsList({ slug }: { slug: string }) {
  const toast = useToast();
  const { data, refetch } = useQuery(CompetitionApplicationsQuery, {
    variables: { slug },
  });
  const { data: viewerData } = useQuery(ViewerQuery, {
    errorPolicy: "ignore",
    fetchPolicy: "cache-first",
  });
  const viewer = viewerData?.viewer ?? null;
  const [review, { loading }] = useMutation(ReviewApplicationMutation);
  const [reinvite, { loading: reinviting }] = useMutation(
    InviteTeamsToCompetitionMutation,
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
  const past = applications.filter(
    (a) => a.status === "REJECTED" || a.status === "CANCELLED",
  );

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

  if (applications.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end">
          {competitionId ? (
            <InviteTeamsModal
              competitionId={competitionId}
              excludeTeamIds={engagedTeamIds}
              onInvited={() => refetch()}
            />
          ) : null}
        </div>
        <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No applications yet. Invite teams to get things started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Confirmed Teams */}
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
                <ApplicationDetailDialog
                  applicationId={app.id}
                  teamName={app.team.name}
                  competitionName={competitionName}
                  viewerId={viewer?.id ?? null}
                  viewerRole={viewer?.role ?? null}
                  triggerLabel="View"
                />
              ) : null
            }
          />
        </Section>
      ) : null}

      {/* Applied */}
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

      {/* Invited */}
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
                <Button
                  size="sm"
                  variant="secondary"
                  loading={reinviting}
                  onClick={() => reinviteOne(app.team!.id)}
                >
                  Re-invite
                </Button>
              ) : null
            }
          />
        )}
      </Section>

      {/* Declined / Withdrawn — audit trail, low emphasis */}
      {past.length > 0 ? (
        <Section title="Declined / Withdrawn" count={past.length}>
          <AppTable
            rows={past}
            lastColLabel="Status"
            renderLast={(app) => (
              <span className="text-xs capitalize text-muted-foreground">
                {app.status.toLowerCase()}
              </span>
            )}
          />
        </Section>
      ) : null}
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
    captain: { id: string; name: string; username: string };
    homeVenue?: { id: string; name: string } | null;
    members: Array<{ id: string }>;
  } | null;
  rosterCaptain?: { id: string; name: string; username: string } | null;
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
                    </Link>
                    {app.rosterCaptain &&
                    app.rosterCaptain.id !== app.team.captain.id ? (
                      <div className="text-xs text-muted-foreground">
                        Roster: {app.rosterCaptain.name}
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
