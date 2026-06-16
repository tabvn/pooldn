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
  await expect(
    page.getByRole("heading", { name: "Browse competitions" }),
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

  await page.getByRole("link", { name: "About" }).click();
  // About tab now lists the structure with multiple "Race to X" chips per block.
  await expect(page.getByText(/Race to/i).first()).toBeVisible();
});

test("anonymous viewer can browse teams and venues", async ({ page }) => {
  await page.goto("/teams");
  await expect(page.getByRole("heading", { name: "Teams" })).toBeVisible();
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
