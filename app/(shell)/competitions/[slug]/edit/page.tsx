import { notFound, redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getClient } from "@/lib/apollo/client";
import { CompetitionEditableQuery } from "@/lib/graphql/operations/competition.operations";
import { CompetitionBannerUpload } from "./banner-upload";
import { CompetitionLocksCard } from "@/components/competition/competition-locks-card";
import { TabEditor } from "./tab-editor";

/**
 * Round-51 — Figma-faithful draft editor.
 *
 * Server-renders the title block & banner / locks cards, then hands the
 * configurable fields off to the four-tab client editor (Participants ·
 * Schedule · Structure · Review & Publish).
 */
export default async function EditCompetitionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const viewer = await requireViewer({
    next: `/competitions/${slug}/edit`,
    roles: ["ORGANIZER", "SUPER_ADMIN"],
  });
  const { data } = await getClient().query({
    query: CompetitionEditableQuery,
    variables: { slug },
  });
  const c = data?.competition;
  if (!c) notFound();
  if (viewer.role !== "SUPER_ADMIN" && c.organizer.id !== viewer.id) {
    redirect(`/competitions/${slug}`);
  }

  return (
    <div className="min-h-full">
      <TabEditor
        initial={{
          id: c.id,
          slug: c.slug,
          name: c.name,
          status: c.status,
          format: c.format ?? "ROUND_ROBIN",
          gameType: c.gameType ?? "EIGHT_BALL",
          type: c.type ?? "TEAMS",
          startDate: c.startDate ?? null,
          prizePool: c.prizePool ?? null,
          currency: c.currency ?? "VND",
          minTeams: c.minTeams ?? 2,
          maxTeams: c.maxTeams ?? null,
          minPlayersPerTeam: c.minPlayersPerTeam ?? 1,
          maxPlayersPerTeam: c.maxPlayersPerTeam ?? null,
          applicationMode: (c.applicationMode ?? "OPEN") as
            | "OPEN"
            | "INVITE_ONLY",
          matchVenueMode: (c.matchVenueMode ?? "TEAM_VENUES") as
            | "TEAM_VENUES"
            | "CENTRAL_VENUE",
          gamesPerOpponent: c.gamesPerOpponent ?? 1,
          schedulingType: c.schedulingType ?? null,
          weekdaySchedule: c.weekdaySchedule ?? [],
          blocks: c.blocks.map((b) => ({
            type: b.type as "SINGLES" | "DOUBLES" | "SCOTCH_DOUBLES",
            games: b.games,
            raceTo: b.raceTo,
            breakAfterMin: b.breakAfterMin,
          })),
        }}
      />

      {/* Round-50 — banner + locks cards live outside the tabs as quick
          admin tools; they're not part of the configurable flow. */}
      <div className="mx-auto max-w-3xl space-y-4 px-4 pb-12 md:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Banner</CardTitle>
          </CardHeader>
          <CardContent>
            <CompetitionBannerUpload
              competitionId={c.id}
              name={c.name}
              bannerUrl={c.bannerUrl ?? null}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Locks</CardTitle>
          </CardHeader>
          <CardContent>
            <CompetitionLocksCard
              competitionId={c.id}
              registrationLocked={c.registrationLocked}
              rosterLocked={c.rosterLocked}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
