import { requireViewer } from "@/lib/auth/server";
import { getClient } from "@/lib/apollo/client";
import { getHeaderCityId } from "@/lib/headers/city";
import {
  CitiesQuery,
  ViewerQuery,
} from "@/lib/graphql/operations/competition.operations";
import { NewTeamForm } from "./form";

export default async function NewTeamPage() {
  // Round-30 — any signed-in non-VIEWER can create a team. They become the
  // captain of THAT team via team.captainId; no global role change required.
  await requireViewer({
    next: "/teams/new",
    roles: ["PLAYER", "TEAM_CAPTAIN", "ORGANIZER", "SUPER_ADMIN"],
  });

  // Round-64 — the new team's home city is the header's active city (you
  // create teams in the city you're browsing). Resolve it server-side and
  // hand the form a read-only id + label. Precedence mirrors the shell
  // header: cookie scope → viewer's profile city → first known city.
  const client = getClient();
  const [headerCityId, citiesRes, viewerRes] = await Promise.all([
    getHeaderCityId(),
    client.query({ query: CitiesQuery, errorPolicy: "ignore" }),
    client.query({ query: ViewerQuery, errorPolicy: "ignore" }),
  ]);
  const cities = citiesRes.data?.cities ?? [];
  const viewerCity = viewerRes.data?.viewer?.city ?? null;
  const city =
    (headerCityId ? cities.find((c) => c.id === headerCityId) : undefined) ??
    (viewerCity ? cities.find((c) => c.id === viewerCity.id) : undefined) ??
    cities[0] ??
    null;
  const cityName = city
    ? `${city.name}, ${city.country.name}`
    : viewerCity?.name ?? null;

  return <NewTeamForm cityId={city?.id ?? null} cityName={cityName} />;
}
