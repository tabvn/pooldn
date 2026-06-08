import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers";

const ONGOING_SLUG = "da-nang-autumn-invitational-2026";

test.describe("Round-9 · Match Flow lineup is driven by MatchFormatBlocks", () => {
  test("renders Singles + Doubles slots and a break marker between blocks", async ({
    page,
  }) => {
    // Find a scheduled match in the ongoing competition (which the seed
    // configures with 3 Singles → 10m break → 2 Doubles).
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

    // The scaffold must show 5 slots — 3 Singles followed by 2 Doubles — and
    // a single break marker between the blocks.
    const scaffold = page.getByTestId("match-lineup-scaffold");
    await expect(scaffold).toBeVisible();
    for (let i = 1; i <= 5; i++) {
      await expect(page.getByTestId(`lineup-slot-${i}`)).toBeVisible();
    }
    await expect(page.getByTestId("match-lineup-break")).toBeVisible();
    await expect(page.getByTestId("match-lineup-break")).toContainText(
      /10 min/i,
    );

    // First three slots are SINGLES, last two are DOUBLES.
    for (const n of [1, 2, 3]) {
      await expect(page.getByTestId(`lineup-slot-${n}`)).toContainText(/singles/i);
    }
    for (const n of [4, 5]) {
      await expect(page.getByTestId(`lineup-slot-${n}`)).toContainText(/doubles/i);
    }
  });
});
