import { notFound, redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth/server";
import { getClient } from "@/lib/apollo/client";
import { CompetitionEditableQuery } from "@/lib/graphql/operations/competition.operations";
import { TabEditor } from "./tab-editor";

/**
 * Round-51 — Figma-faithful draft editor.
 *
 * Loads the editable competition and hands the configurable fields off to
 * the four-tab client editor (Participants · Schedule · Structure ·
 * Review & Publish). Round-55 dropped the banner upload + locks cards
 * that used to sit beneath the editor — they're not in the Figma draft
 * screen and we'll re-add them as a dedicated admin surface later.
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
          centralVenueId: c.centralVenue?.id ?? null,
          gamesPerOpponent: c.gamesPerOpponent ?? 1,
          // Round-58 — the column default is the legacy FLEXIBLE, which the
          // two-segment Figma selector can't represent (neither segment
          // would highlight). Normalise: anything that isn't explicitly
          // FIXED_MATCHDAYS edits as Weekly Rounds, and the first save
          // persists the normalised value.
          schedulingType:
            c.schedulingType === "FIXED_MATCHDAYS"
              ? "FIXED_MATCHDAYS"
              : "WEEKLY_ROUNDS",
          weekdaySchedule: c.weekdaySchedule ?? [],
          fixedMatchDates: c.fixedMatchDates ?? [],
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
