import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers";

test.describe("Round-64 · single-screen Create Team", () => {
  test("creates a team with the header city and lands on the team page", async ({
    page,
  }) => {
    await signInAs(page, "hai");
    await page.goto("/teams/new");

    // Figma page title + no wizard steps.
    await expect(page.getByRole("heading", { name: "Create Team" })).toBeVisible();
    // Home city is auto-assigned from the header location (Da Nang seed).
    await expect(page.getByTestId("home-city")).toContainText(/Da Nang/i);

    // Name starts with "e2e " so the slug (e2e-cue-crew) is cleaned by reseed.
    await page.getByTestId("team-name").fill("e2e Cue Crew");
    await page.getByTestId("create-team-submit").click();

    // Lands on the new team's detail page (slug derived from the name) — no
    // wizard, no extra steps.
    await page.waitForURL(/\/teams\/e2e-cue-crew$/);
    await expect(page.getByText("e2e Cue Crew").first()).toBeVisible();
  });
});
