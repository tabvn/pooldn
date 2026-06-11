import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  Lock,
  Trophy,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApplicationStatusChip } from "@/components/ui/status-chip";
import { ApplicationDetailView } from "@/components/competition/application-detail-view";
import { getClient } from "@/lib/apollo/client";
import {
  CompetitionApplicationDetailQuery,
  ViewerQuery,
} from "@/lib/graphql/operations/competition.operations";

/**
 * Round-50 — dedicated application detail page. Shares the
 * ApplicationDetailView component with the side-sheet so the body never
 * drifts; the page itself wraps it in a richer header with competition
 * context, breadcrumbs, lock indicators, and a role-aware welcome banner.
 */
export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ slug: string; appId: string }>;
}) {
  const { slug, appId } = await params;
  const client = getClient();
  const [{ data }, viewerResult] = await Promise.all([
    client.query({
      query: CompetitionApplicationDetailQuery,
      variables: { id: appId },
    }),
    client.query({ query: ViewerQuery, errorPolicy: "ignore" }),
  ]);
  const app = data?.competitionApplication;
  if (!app || app.competition.slug !== slug) notFound();
  // Round-53 — INDIVIDUAL (solo) apps have no team and don't fit this
  // detail view yet; redirect back to the applications list so the
  // organizer at least lands somewhere coherent.
  if (!app.team) {
    notFound();
  }
  const viewer = viewerResult.data?.viewer ?? null;

  const isCaptain = viewer?.id === app.team.captain.id;
  const isOrganizer = viewer?.id === app.competition.organizer.id;
  const isAdmin = viewer?.role === "SUPER_ADMIN";
  const canManageRoster =
    (isCaptain && !app.competition.rosterLocked) || isOrganizer || isAdmin;
  const isPendingForOrg =
    (isOrganizer || isAdmin) && app.status === "PENDING";

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      {/* Breadcrumbs */}
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
      >
        <Link
          href="/competitions"
          className="hover:text-foreground hover:underline"
        >
          Competitions
        </Link>
        <ChevronRight className="size-3" />
        <Link
          href={`/competitions/${slug}`}
          className="hover:text-foreground hover:underline"
        >
          {app.competition.name}
        </Link>
        <ChevronRight className="size-3" />
        <Link
          href={`/competitions/${slug}/applications`}
          className="hover:text-foreground hover:underline"
        >
          Applications
        </Link>
        <ChevronRight className="size-3" />
        <span className="font-medium text-foreground">{app.team.name}</span>
      </nav>

      {/* Hero — team header with status + competition + locks */}
      <header className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Avatar
              size="xl"
              src={app.team.logoUrl ?? undefined}
              fallback={app.team.name}
              shape="team"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                  {app.team.name}
                </h1>
                <ApplicationStatusChip status={app.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Application to{" "}
                <Link
                  href={`/competitions/${slug}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {app.competition.name}
                </Link>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" />
                  Captain{" "}
                  <Link
                    href={`/players/${app.team.captain.username}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {app.team.captain.name}
                  </Link>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="size-3.5" />
                  Submitted {fmtDate(app.submittedAt)}
                </span>
                {app.reviewedAt ? (
                  <span className="inline-flex items-center gap-1">
                    <Trophy className="size-3.5" />
                    Reviewed {fmtDate(app.reviewedAt)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <Link
            href={`/competitions/${slug}/applications`}
            className="shrink-0"
          >
            <Button variant="ghost" size="sm">
              <ArrowLeft className="size-4" /> All applications
            </Button>
          </Link>
        </div>

        {/* Lock indicators */}
        {app.competition.rosterLocked || app.competition.registrationLocked ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {app.competition.registrationLocked ? (
              <Badge variant="warning" size="sm">
                <Lock className="size-3" />
                Registration locked
              </Badge>
            ) : null}
            {app.competition.rosterLocked ? (
              <Badge variant="warning" size="sm">
                <Lock className="size-3" />
                Roster edits locked
              </Badge>
            ) : null}
          </div>
        ) : null}
      </header>

      {/* Role-aware welcome banner */}
      {isCaptain ? (
        <RoleBanner
          tone="primary"
          title="This is your team"
          body={
            app.competition.rosterLocked
              ? "Roster edits are locked by the organizer. You can still review the current roster below."
              : app.status === "APPROVED"
                ? "Need to swap a player? Use Propose roster change — the organizer will review your request."
                : app.status === "PENDING"
                  ? "Your application is awaiting the organizer's review. You can still edit the proposed roster while it's pending."
                  : "Application details are below."
          }
        />
      ) : isPendingForOrg ? (
        <RoleBanner
          tone="warning"
          title="Awaiting your review"
          body="Read the proposed roster, then approve or reject from the actions below."
        />
      ) : isOrganizer || isAdmin ? (
        <RoleBanner
          tone="info"
          title={isAdmin ? "Admin view" : "Organizer view"}
          body={
            canManageRoster
              ? "You can edit this roster in place; captain proposals are queued in a separate request."
              : "Read-only details below."
          }
        />
      ) : null}

      {/* Detail body — the reusable view component */}
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <ApplicationDetailView
          applicationId={app.id}
          viewerId={viewer?.id ?? null}
          viewerRole={viewer?.role ?? null}
        />
      </section>
    </div>
  );
}

function RoleBanner({
  tone,
  title,
  body,
}: {
  tone: "primary" | "warning" | "info";
  title: string;
  body: string;
}) {
  const cls =
    tone === "warning"
      ? "border-warning/40 bg-warning/5 text-warning"
      : tone === "info"
        ? "border-info/40 bg-info/5"
        : "border-primary/40 bg-primary/5";
  return (
    <div className={`rounded-xl border px-4 py-3 ${cls}`}>
      <div className="text-sm font-semibold">{title}</div>
      <p className="text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

function fmtDate(value: string | Date | null | undefined) {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString();
}
