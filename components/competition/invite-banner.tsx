"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client/react";
import { Mail, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
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
 * Shows once per invited team the viewer captains. Accept routes through the
 * existing apply form (so the captain still picks the roster + roster
 * captain — the mutation flips the INVITED row to PENDING on submit).
 * Decline cancels the row via withdrawApplication.
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
  const confirm = useConfirm();
  const { data: viewerData } = useQuery(ViewerQuery, {
    fetchPolicy: "cache-first",
    errorPolicy: "ignore",
  });
  const { data: myTeamsData } = useQuery(MyTeamsQuery, {
    fetchPolicy: "cache-first",
    errorPolicy: "ignore",
  });
  const [withdraw, { loading: declining }] = useMutation(
    WithdrawApplicationMutation,
    { refetchQueries: ["CompetitionOverview"] },
  );

  const viewerId = viewerData?.viewer?.id ?? null;
  // A team I captain (or am the registered admin/captain on) — keep the set
  // small so the filter below is O(invites).
  const myCaptainedTeamIds = new Set(
    (myTeamsData?.myTeams ?? [])
      .filter((t) => t.captain?.id === viewerId)
      .map((t) => t.id),
  );

  const invites = applications.filter(
    (a) =>
      a.status === "INVITED" &&
      (a.team.captain.id === viewerId || myCaptainedTeamIds.has(a.team.id)),
  );
  if (!viewerId || invites.length === 0) return null;

  async function decline(appId: string, teamName: string) {
    const ok = await confirm({
      title: `Decline invite for ${teamName}?`,
      description:
        "The organizer will see this team as cancelled. They can re-invite you later.",
      destructive: true,
      confirmLabel: "Decline invite",
    });
    if (!ok) return;
    try {
      await withdraw({ variables: { id: appId } });
      toast.success("Invite declined");
      router.refresh();
    } catch (e) {
      toast.error(
        "Couldn't decline invite",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

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
                You're invited as <Link href={`/teams/${app.team.slug}`} className="hover:underline">{app.team.name}</Link>
              </div>
              <div className="text-xs text-muted-foreground">
                The organizer wants your team in this competition. Accept to
                pick your roster, or decline if you can't make it.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              loading={declining}
              onClick={() => decline(app.id, app.team.name)}
              data-testid={`competition-invite-decline-${app.team.slug}`}
            >
              <X className="size-4" />
              Decline
            </Button>
            <Link
              href={`/competitions/${competitionSlug}/apply?teamId=${app.team.id}`}
              data-testid={`competition-invite-accept-${app.team.slug}`}
            >
              <Button variant="primary" size="sm">
                Accept invite
              </Button>
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
