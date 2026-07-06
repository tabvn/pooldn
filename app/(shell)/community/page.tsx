import { getHeaderCityId, getHeaderCityName } from "@/lib/headers/city";
import { CommunityPlayers } from "./players";

export default async function CommunityPage() {
  const [headerCityId, headerCityName] = await Promise.all([
    getHeaderCityId(),
    getHeaderCityName(),
  ]);
  return (
    <CommunityPlayers
      cityId={headerCityId ?? null}
      cityName={headerCityName ?? null}
    />
  );
}
