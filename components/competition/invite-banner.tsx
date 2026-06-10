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
import {
  AcceptCompetitionInviteMutation,
  WithdrawApplicationMutation,
} from "@/lib/graphql/operations/competition-mutations.operations";

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
 * Both Accept and Decline run in-place: button → loading spinner →
 * banner dismisses → Sonner toast. Accept flips the row INVITED → PENDING
 * (roster left empty, captain edits later); Decline flips to CANCELLED via
 * withdrawApplication. We dismiss optimistically before the refresh so the
 * banner doesn't briefly re-render with the old data.
 */
export function InviteBanner({
  competitionSlug,
  applications,
}: {
  competitionSlug: string;
  applications: InvitedApp[];
}) {
  void competitionSlug;
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
  const [accept] = useMutation(AcceptCompetitionInviteMutation);
  const [withdraw] = useMutation(WithdrawApplicationMutation);

  const [pending, setPending] = useState<Record<string, "accept" | "decline" | undefined>>({});
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

  async function onAccept(appId: string, teamName: string) {
    setPending((p) => ({ ...p, [appId]: "accept" }));
    try {
      await accept({ variables: { applicationId: appId } });
      setDismissed((s) => new Set(s).add(appId));
      toast.success(
        `Invite accepted for ${teamName}`,
        "Your application is now pending the organizer's review.",
      );
      router.refresh();
    } catch (e) {
      toast.error(
        "Couldn't accept invite",
        e instanceof Error ? e.message : "Try again.",
      );
    } finally {
      setPending((p) => {
        const { [appId]: _, ...rest } = p;
        return rest;
      });
    }
  }

  async function onDecline(appId: string, teamName: string) {
    setPending((p) => ({ ...p, [appId]: "decline" }));
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
      setPending((p) => {
        const { [appId]: _, ...rest } = p;
        return rest;
      });
    }
  }

  return (
    <div className="space-y-3">
      {invites.map((app) => {
        const state = pending[app.id];
        const accepting = state === "accept";
        const declining = state === "decline";
        const anyAction = accepting || declining;
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
                  The organizer wants your team in this competition. Accept to
                  send your application, or decline if you can't make it.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                loading={declining}
                disabled={anyAction}
                onClick={() => onDecline(app.id, app.team.name)}
                data-testid={`competition-invite-decline-${app.team.slug}`}
              >
                <X className="size-4" />
                Decline
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={accepting}
                disabled={anyAction}
                onClick={() => onAccept(app.id, app.team.name)}
                data-testid={`competition-invite-accept-${app.team.slug}`}
              >
                Accept invite
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
