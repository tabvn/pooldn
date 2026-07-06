import { cookies } from "next/headers";
import { getClient } from "@/lib/apollo/client";
import { CitiesQuery } from "@/lib/graphql/operations/competition.operations";

/**
 * Round-45 — read the header city scope from the `pooldn_city` cookie.
 *
 *   "all"          → no filter (user explicitly opted into global view)
 *   "<cityId>"     → scope every list query to that city
 *   missing        → fall through to: single active city pin → null
 *
 * Pages call this once at the top of their SSR data fetch and pass it as
 * `cityId` into their list query. The CitySelector writes the cookie + calls
 * router.refresh() so the next render picks up the new scope automatically.
 *
 * R45+ — if only ONE active city exists in the system, we auto-pin to it
 * regardless of what the cookie says, so the user can't get into a confusing
 * "All cities" state when there's nothing to switch between.
 */
export async function getHeaderCityId(): Promise<string | null> {
  const cookieStore = await cookies();
  const v = cookieStore.get("pooldn_city")?.value;

  // Single-city auto-pin overrides everything (including "all").
  try {
    const { data } = await getClient().query({
      query: CitiesQuery,
      errorPolicy: "ignore",
    });
    const cities = data?.cities ?? [];
    if (cities.length === 1) return cities[0]!.id;
  } catch {
    // Apollo can fail under hot-reload; fall through to cookie semantics.
  }

  if (!v || v === "all") return null;
  return v;
}

/**
 * The display name of the active header city, using the SAME precedence as
 * getHeaderCityId so it's truthful: it returns a name only when list content
 * is actually scoped to that city (explicit pick, or single-city auto-pin),
 * and null for the unscoped "All cities" / no-pick state.
 *
 * Used to qualify page titles ("Teams in Da Nang") so a wrong-location pick
 * is obvious. Returns null → callers fall back to the bare title.
 */
export async function getHeaderCityName(): Promise<string | null> {
  const cookieStore = await cookies();
  const v = cookieStore.get("pooldn_city")?.value;
  try {
    const { data } = await getClient().query({
      query: CitiesQuery,
      errorPolicy: "ignore",
    });
    const cities = data?.cities ?? [];
    // Single active city auto-pin (mirrors getHeaderCityId).
    if (cities.length === 1) return cities[0]!.name;
    if (!v || v === "all") return null;
    return cities.find((c) => c.id === v)?.name ?? null;
  } catch {
    return null;
  }
}
