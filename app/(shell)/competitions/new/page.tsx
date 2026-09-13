import { requireViewer } from "@/lib/auth/server";
import { getHeaderCityId, getHeaderCityName } from "@/lib/headers/city";
import { BasicsForm } from "./basics-form";

/**
 * Round-51 — Competition creation, Figma-faithful "Create New Competition"
 * basics screen. Captures only the seven core fields shown in the design
 * (name, description, game, format, type, start date, prize). The remaining
 * setup happens after create in the 4-tab editor (Participants · Structure
 * · Schedule · Review & Publish).
 */
export default async function NewCompetitionPage() {
  // Anyone signed in can organize a competition EXCEPT the read-only VIEWER
  // persona. The viewer is the organizerId on the new row, and per-entity CASL
  // grants them manage rights on it (same pattern as captaincy being per-team,
  // not a global role). Guests are redirected to sign-in by requireViewer.
  await requireViewer({
    next: "/competitions/new",
    roles: ["SUPER_ADMIN", "ORGANIZER", "TEAM_CAPTAIN", "PLAYER"],
  });
  // Round-76 — stamp the new competition with the header-selected city.
  // City is the app's top-level content filter and the competitions resolver
  // matches it exactly, so a city-less competition is invisible on every
  // scoped surface (dashboard rails, /competitions). Reading the same header
  // scope the organizer is already browsing in keeps "created here" and
  // "listed here" the same place.
  const [cityId, cityName] = await Promise.all([
    getHeaderCityId(),
    getHeaderCityName(),
  ]);
  return <BasicsForm cityId={cityId} cityName={cityName} />;
}
