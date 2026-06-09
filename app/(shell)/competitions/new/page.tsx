import { cookies } from "next/headers";
import { requireViewer } from "@/lib/auth/server";
import { NewCompetitionForm } from "./form";

export default async function NewCompetitionPage() {
  // Anyone signed in can organize a competition. The viewer is the
  // organizerId on the new row, and per-entity CASL grants them manage
  // rights on it (same pattern as captaincy being per-team, not a global role).
  await requireViewer({ next: "/competitions/new" });
  // Round-45 — default the wizard's city to whatever the header is scoped to,
  // so a Da Nang organizer doesn't have to pick "Da Nang" every single time.
  // The "all"/empty sentinels are treated as no default.
  const cookieStore = await cookies();
  const headerCityId = cookieStore.get("pooldn_city")?.value ?? "";
  const defaultCityId =
    headerCityId && headerCityId !== "all" ? headerCityId : null;
  return <NewCompetitionForm defaultCityId={defaultCityId} />;
}
