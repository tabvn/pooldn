"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client/react";
import { Mail, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ViewerQuery } from "@/lib/graphql/operations/competition.operations";
import { MyTeamsQuery } from "@/lib/graphql/operations/team.operations";
import { WithdrawApplicationMutation } from "@/lib/graphql/operations/competition-mutations.operations";

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
 * Round-49 — captain-facing invite banner.
 *
 * Accept routes through the existing /apply form so the captain reuses
 * the same roster + roster-captain picker that any other applicant goes
 * through (the INVITED row joins the resurrection path in
 * applyToCompetition, so the existing form submission flips it to
 * PENDING). Decline runs in-place: spinner → optimistic dismiss → Sonner
 * toast, no confirm dialog.
 */
export function InviteBanner({
  competitionSlug,
  applications,
}: {
  competitionSlug: string;
  applications: InvitedApp[];
}) {
  const router = useRouter();
  const toast = useToast();
  const { data: viewerData } = useQuery(ViewerQuery, {
    fetchPolicy: "cache-first",
    errorPolicy: "ignore",
  });
  const { data: myTeamsData } = useQuery(MyTeamsQuery, {
    fetchPolicy: "cache-first",
    errorPolicy: "ignore",
  });
  const [withdraw] = useMutation(WithdrawApplicationMutation);

  const [declining, setDeclining] = useState<Set<string>>(new Set());
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

  async function onDecline(appId: string, teamName: string) {
    setDeclining((s) => new Set(s).add(appId));
    try {
      await withdraw({ variables: { id: appId } });
      setDismissed((s) => new Set(s).add(appId));
      toast.success(
        `Invite declined for ${teamName}`,
        "The organizer can re-invite your team later if they'd like.",
      );
      router.refresh();
    } catch (e) {
      toast.error(
        "Couldn't decline invite",
        e instanceof Error ? e.message : "Try again.",
      );
    } finally {
      setDeclining((s) => {
        const next = new Set(s);
        next.delete(appId);
        return next;
      });
    }
  }

  return (
    <div className="space-y-3">
      {invites.map((app) => {
        const isDeclining = declining.has(app.id);
        return (
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
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                loading={isDeclining}
                disabled={isDeclining}
                onClick={() => onDecline(app.id, app.team.name)}
                data-testid={`competition-invite-decline-${app.team.slug}`}
              >
                <X className="size-4" />
                Decline
              </Button>
              <Link
                href={`/competitions/${competitionSlug}/apply?teamId=${app.team.id}`}
                data-testid={`competition-invite-accept-${app.team.slug}`}
              >
                <Button variant="primary" size="sm" disabled={isDeclining}>
                  Accept invite
                </Button>
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
