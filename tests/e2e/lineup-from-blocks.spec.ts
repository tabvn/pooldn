import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers";

const ONGOING_SLUG = "da-nang-autumn-invitational-2026";

test.describe("Round-9 · Match Flow lineup is driven by MatchFormatBlocks", () => {
  test("renders Singles + Doubles slots and break markers between blocks", async ({
    page,
  }) => {
    // Seed structure: 3 Singles → 10m break → 2 Doubles → 5m break → 3 Singles
    // (8 frames, 2 break separators).
    await signInAs(page, "michael");
    const res = await page.request.post("/api/graphql", {
      data: {
        query: `query { competition(slug: "${ONGOING_SLUG}") {
          matchdays { matches { id status } }
        } }`,
      },
    });
    const matchdays = (await res.json()).data.competition.matchdays;
    const match = matchdays
      .flatMap((m: { matches: Array<{ id: string; status: string }> }) => m.matches)
      .find((m: { status: string }) => m.status !== "COMPLETED");
    expect(match, "expected a non-completed seeded match").toBeTruthy();

    await page.goto(`/matches/${match.id}`);

    const scaffold = page.getByTestId("match-lineup-scaffold");
    await expect(scaffold).toBeVisible();
    for (let i = 1; i <= 8; i++) {
      await expect(page.getByTestId(`lineup-slot-${i}`)).toBeVisible();
    }
    // Two break markers — 10 min after block 1, 5 min after block 2.
    const breaks = page.getByTestId("match-lineup-break");
    await expect(breaks).toHaveCount(2);
    await expect(breaks.first()).toContainText(/10 min/i);
    await expect(breaks.nth(1)).toContainText(/5 min/i);

    // Slot types follow the structure: 1-3 Singles, 4-5 Doubles, 6-8 Singles.
    for (const n of [1, 2, 3, 6, 7, 8]) {
      await expect(page.getByTestId(`lineup-slot-${n}`)).toContainText(/singles/i);
    }
    for (const n of [4, 5]) {
      await expect(page.getByTestId(`lineup-slot-${n}`)).toContainText(/doubles/i);
    }
  });
});
