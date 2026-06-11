"use client";

import Link from "next/link";
import { Lock, Settings, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ApplicationDetailDialog } from "./application-detail-dialog";

/**
 * Round-50 — horizontal scrolling strip of confirmed teams on the
 * competition overview. Surfaces the viewer's own team(s) first with a
 * primary "Manage your team" CTA so the captain has a single, obvious entry
 * point into the Application detail (where they can propose roster changes
 * while the competition allows it).
 *
 * Non-captain viewers see a subtle card and a "View roster" link that
 * routes to the dedicated /applications/[appId] page. Both flows mount the
 * same ApplicationDetailView underneath.
 */
type TeamCaptain = { id: string; name: string; username: string };
type ConfirmedTeamApp = {
  id: string;
  status: string;
  team: {
    id: string;
    slug: string;
    name: string;
    logoUrl?: string | null;
    captain: TeamCaptain;
    members: Array<{ id: string }>;
  } | null;
};

export function ConfirmedTeamsRow({
  competitionName,
  competitionStatus,
  rosterLocked,
  applications,
  viewerId,
  viewerRole,
  maxTeams,
}: {
  competitionName: string;
  competitionStatus: string;
  rosterLocked: boolean;
  applications: ConfirmedTeamApp[];
  viewerId: string | null;
  viewerRole: string | null;
  maxTeams: number | null;
}) {
  // Round-53 — this row is the "confirmed TEAMS" strip; INDIVIDUAL
  // (solo) applications are surfaced elsewhere so we filter them out
  // here rather than carry nullable team narrowings through the rest
  // of the component.
  const approved = applications.filter(
    (a) => a.status === "APPROVED" && a.team !== null,
  ) as Array<ConfirmedTeamApp & { team: NonNullable<ConfirmedTeamApp["team"]> }>;
  if (approved.length === 0) return null;

  const myAppIds = new Set(
    viewerId
      ? approved
          .filter((a) => a.team.captain.id === viewerId)
          .map((a) => a.id)
      : [],
  );
  const sorted = [...approved].sort((a, b) => {
    const am = myAppIds.has(a.id) ? 1 : 0;
    const bm = myAppIds.has(b.id) ? 1 : 0;
    if (am !== bm) return bm - am;
    return a.team.name.localeCompare(b.team.name);
  });

  const isCaptain = myAppIds.size > 0;
  // Captains can propose changes only when the application is in flight and
  // the organizer hasn't locked the roster. We surface a banner so the
  // captain understands why the CTA is disabled when those preconditions
  // don't hold (vs silently changing the button copy).
  const compAcceptsChanges =
    competitionStatus === "OPEN_FOR_APPLICATIONS" ||
    competitionStatus === "APPLICATIONS_CLOSED" ||
    competitionStatus === "ONGOING";
  const captainCanPropose = isCaptain && !rosterLocked && compAcceptsChanges;

  return (
    <section
      className="rounded-xl border border-border bg-card p-4"
      data-testid="confirmed-teams"
    >
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Confirmed teams
          </h3>
          {isCaptain ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {captainCanPropose ? (
                <>
                  Tap{" "}
                  <span className="font-semibold text-primary">
                    Manage your team
                  </span>{" "}
                  to view or change your roster.
                </>
              ) : rosterLocked ? (
                <span className="inline-flex items-center gap-1 text-warning">
                  <Lock className="size-3.5" />
                  Roster edits locked — view only.
                </span>
              ) : (
                "Roster changes aren't accepted in this state."
              )}
            </p>
          ) : null}
        </div>
        <Badge variant="primary" size="sm">
          {approved.length}
          {maxTeams ? ` / ${maxTeams}` : ""}
        </Badge>
      </header>

      <div
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
        data-testid="confirmed-teams-scroller"
      >
        {sorted.map((a) => (
          <TeamCard
            key={a.id}
            competitionName={competitionName}
            app={a}
            isMyTeam={myAppIds.has(a.id)}
            viewerId={viewerId}
            viewerRole={viewerRole}
          />
        ))}
      </div>
    </section>
  );
}

function TeamCard({
  competitionName,
  app,
  isMyTeam,
  viewerId,
  viewerRole,
}: {
  competitionName: string;
  app: ConfirmedTeamApp & { team: NonNullable<ConfirmedTeamApp["team"]> };
  isMyTeam: boolean;
  viewerId: string | null;
  viewerRole: string | null;
}) {
  const memberCount = app.team.members.length;
  return (
    <article
      className={
        "flex w-72 shrink-0 snap-start flex-col gap-3 rounded-xl border p-4 transition-colors " +
        (isMyTeam
          ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
          : "border-border bg-background hover:border-primary/30")
      }
      data-testid={`confirmed-team-${app.team.id}`}
    >
      <header className="flex items-start gap-3">
        <Avatar
          size="lg"
          src={app.team.logoUrl ?? undefined}
          fallback={app.team.name}
          shape="team"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href={`/teams/${app.team.slug}`}
              className="truncate text-base font-semibold hover:underline"
            >
              {app.team.name}
            </Link>
            {isMyTeam ? (
              <Badge variant="primary" size="sm">
                Your team
              </Badge>
            ) : null}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            Captain{" "}
            <Link
              href={`/players/${app.team.captain.username}`}
              className="hover:underline"
            >
              {app.team.captain.name}
            </Link>
          </div>
          <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="size-3" />
            {memberCount} member{memberCount === 1 ? "" : "s"}
          </div>
        </div>
      </header>

      <footer className="mt-auto">
        {/* Same drawer for every viewer — ApplicationDetailView surfaces the
            role-appropriate actions (Approve/Reject for org/admin, Propose
            change for captains, read-only for the public). The trigger
            varies so captains see a primary, action-flavoured CTA. */}
        <ApplicationDetailDialog
          applicationId={app.id}
          teamName={app.team.name}
          competitionName={competitionName}
          viewerId={viewerId}
          viewerRole={viewerRole}
          triggerLabel={isMyTeam ? "Manage your team" : "View roster"}
          triggerVariant={isMyTeam ? "primary" : "ghost"}
          triggerIcon={isMyTeam ? <Settings className="size-4" /> : undefined}
          triggerClassName="w-full"
        />
      </footer>
    </article>
  );
}
