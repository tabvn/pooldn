import { notFound, redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getClient } from "@/lib/apollo/client";
import { CompetitionEditableQuery } from "@/lib/graphql/operations/competition.operations";
import { NewCompetitionForm } from "@/app/(shell)/competitions/new/form";
import { CompetitionBannerUpload } from "./banner-upload";

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
      <div className="px-8 pt-6">
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
      </div>
      <NewCompetitionForm
        initial={{
          id: c.id,
          slug: c.slug,
          name: c.name,
          description: c.description,
          rulesUrl: c.rulesUrl,
          type: c.type,
          format: c.format,
          gameType: c.gameType,
          minTeams: c.minTeams,
          maxTeams: c.maxTeams,
          minPlayersPerTeam: c.minPlayersPerTeam,
          maxPlayersPerTeam: c.maxPlayersPerTeam,
          raceToFrames: c.raceToFrames,
          cityId: c.city?.id ?? null,
          schedulingType: c.schedulingType,
          startDate: c.startDate,
          endDate: c.endDate,
          prizePool: c.prizePool,
          currency: c.currency,
          breakAndRunRule: c.breakAndRunRule,
          requiresHomeVenue: c.requiresHomeVenue,
          maxGamesPerVenuePerMatchday: c.maxGamesPerVenuePerMatchday,
          blocks: c.blocks.map((b) => ({
            type: b.type as "SINGLES" | "DOUBLES" | "SCOTCH_DOUBLES",
            games: b.games,
            raceTo: b.raceTo,
            breakAfterMin: b.breakAfterMin,
          })),
        }}
      />
    </div>
  );
}
