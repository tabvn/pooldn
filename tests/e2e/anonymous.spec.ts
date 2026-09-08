import { test, expect } from "@playwright/test";

test("anonymous viewer can browse the Poolhub dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1 }),
  ).toContainText(/welcome/i);
  // Anonymous dashboard surfaces the Upcoming + Active sections.
  await expect(
    page.getByRole("heading", { name: "Upcoming competitions" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Active competitions" }),
  ).toBeVisible();
});

test("anonymous viewer can browse /competitions", async ({ page }) => {
  await page.goto("/competitions");
  // The browse screen's h1 is "Competitions"; "Browse competitions" is the
  // empty-state link label, not the heading.
  await expect(
    page.getByRole("heading", { name: "Competitions", exact: true }),
  ).toBeVisible();
});

test("anonymous viewer sees the sign-in link in the header", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("anonymous viewer can browse a Competition's tabs", async ({ page }) => {
  await page.goto("/competitions/da-nang-international-pool-league-2026");
  await expect(
    page.getByRole("heading", { name: "Da Nang International Pool League" }),
  ).toBeVisible();
  await expect(page.getByText("League Standings")).toBeVisible();
  await expect(page.getByText("Gen Filling Station").first()).toBeVisible();
  await expect(page.getByText("Winner!")).toBeVisible();
  // MVP = highest frames-won % (Round-18). Gen has 5/8 = 62.5% vs Thomas 4/8.
  await expect(page.getByText("Gen Hoang").first()).toBeVisible();

  await page.getByRole("link", { name: "Matchdays" }).click();
  await expect(page.getByText(/Matchday 1/)).toBeVisible();

  await page.getByRole("link", { name: "Players" }).click();
  await expect(
    page.getByRole("cell", { name: /Gen Hoang/ }),
  ).toBeVisible();

  // Scope to the page body: the sidebar has its own "About" link, so an
  // unscoped role query is ambiguous under strict mode.
  await page.locator("#app-scroll").getByRole("link", { name: "About" }).click();
  // About tab lists the competition's structure. A team competition shows the
  // per-matchday layout; "Race To" is the Singles-only row.
  await expect(page.getByText("Match Layout")).toBeVisible();
});

test("anonymous viewer can browse teams and venues", async ({ page }) => {
  await page.goto("/teams");
  await expect(
    page.getByRole("heading", { name: /^Teams( in .+)?$/ }),
  ).toBeVisible();
  await expect(page.getByText("Gen Filling Station")).toBeVisible();

  await page.getByText("Gen Filling Station").first().click();
  await expect(
    page.getByRole("heading", { name: "Gen Filling Station" }),
  ).toBeVisible();
  await expect(page.getByText("Players")).toBeVisible();

  await page.goto("/venues");
  await expect(page.getByRole("heading", { name: "Venues" })).toBeVisible();
  await expect(page.getByText("Pool Paradise")).toBeVisible();
});
