import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers";

test.describe("Match flow", () => {
  test("anonymous user can reach a match (guests view details)", async ({
    page,
  }) => {
    // Guests can view match details for public competitions (no sign-in
    // redirect); a bad id renders the not-found state read-only.
    await page.goto("/matches/nonexistent-id");
    await expect(page.getByText(/match not found/i)).toBeVisible();
  });

  test("authenticated viewer renders match-not-found for bad id", async ({
    page,
  }) => {
    await signInAs(page, "toan");
    await page.goto("/matches/does-not-exist");
    await expect(page.getByText(/match not found/i)).toBeVisible();
  });

  test("captain can open the seeded match", async ({ page, request }) => {
    // Find the seeded match id via GraphQL so the test isn't tied to a
    // hardcoded UUID.
    const res = await request.post("/api/graphql", {
      data: {
        query: `{ competition(slug:"da-nang-international-pool-league-2026"){ matchdays{ matches{ id } } } }`,
      },
    });
    const json = await res.json();
    const matchId =
      json?.data?.competition?.matchdays?.[0]?.matches?.[0]?.id;
    test.skip(!matchId, "no seeded match available");

    await signInAs(page, "gen");
    await page.goto(`/matches/${matchId}`);
    await expect(
      page.getByRole("heading", { name: "Match Details" }),
    ).toBeVisible();
    await expect(page.getByText("Match Lineups")).toBeVisible();
  });

  test("logout from match flow lands at /sign-in", async ({ page }) => {
    await signInAs(page, "michael");
    await page.goto("/notifications");
    await page.getByRole("button", { name: /open viewer menu/i }).click(); await page.getByRole("menuitem", { name: /sign out/i }).click();
    await page.waitForURL(/\/sign-in/);
  });
});
