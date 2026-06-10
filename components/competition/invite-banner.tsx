"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@apollo/client/react";
import { Mail } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { ViewerQuery } from "@/lib/graphql/operations/competition.operations";
import { MyTeamsQuery } from "@/lib/graphql/operations/team.operations";
import { CompetitionInviteActions } from "./competition-invite-actions";

type InvitedApp = {
  id: string;
  status: string;
  team: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
    captain: { id: string };
  };
};

/**
 * Round-49 — captain-facing invite banner on the competition overview page.
 * Filters the comp's applications down to the viewer's INVITED rows, then
 * delegates to the shared CompetitionInviteActions for buttons + behaviour.
 */
export function InviteBanner({
  competitionSlug,
  applications,
}: {
  competitionSlug: string;
  applications: InvitedApp[];
}) {
  const { data: viewerData } = useQuery(ViewerQuery, {
    fetchPolicy: "cache-first",
    errorPolicy: "ignore",
  });
  const { data: myTeamsData } = useQuery(MyTeamsQuery, {
    fetchPolicy: "cache-first",
    errorPolicy: "ignore",
  });

  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const viewerId = viewerData?.viewer?.id ?? null;
  const myCaptainedTeamIds = new Set(
    (myTeamsData?.myTeams ?? [])
      .filter((t) => t.captain?.id === viewerId)
      .map((t) => t.id),
  );

  const invites = applications.filter(
    (a) =>
      a.status === "INVITED" &&
      !dismissed.has(a.id) &&
      (a.team.captain.id === viewerId || myCaptainedTeamIds.has(a.team.id)),
  );
  if (!viewerId || invites.length === 0) return null;

  return (
    <div className="space-y-3">
      {invites.map((app) => (
        <div
          key={app.id}
          data-testid={`competition-invite-banner-${app.team.slug}`}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm"
        >
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
            <Mail className="size-4" />
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar
              size="sm"
              src={app.team.logoUrl ?? undefined}
              fallback={app.team.name}
              shape="team"
            />
            <div className="min-w-0">
              <div className="font-semibold">
                You're invited as{" "}
                <Link
                  href={`/teams/${app.team.slug}`}
                  className="hover:underline"
                >
                  {app.team.name}
                </Link>
              </div>
              <div className="text-xs text-muted-foreground">
                Accept to pick your roster (same form any team uses to
                apply), or decline if you can't make it.
              </div>
            </div>
          </div>
          <CompetitionInviteActions
            applicationId={app.id}
            competitionSlug={competitionSlug}
            teamId={app.team.id}
            teamName={app.team.name}
            onDeclined={() =>
              setDismissed((s) => new Set(s).add(app.id))
            }
          />
        </div>
      ))}
    </div>
  );
}
