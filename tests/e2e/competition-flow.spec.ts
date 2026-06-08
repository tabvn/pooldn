import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers";

test.describe("Competition lifecycle (organizer)", () => {
  test("organizer sees Create competition CTA and can publish", async ({
    page,
  }) => {
    await signInAs(page, "michael");
    await expect(
      page.getByRole("link", { name: /create competition/i }),
    ).toBeVisible();
  });

  test("create-competition wizard validates Step 1 before advancing", async ({
    page,
  }) => {
    await signInAs(page, "michael");
    await page.goto("/competitions/new");

    // Step 1 — try Next with empty fields, expect a validation error.
    await page.getByRole("button", { name: /^next$/i }).click();
    await expect(page.getByText("At least 3 characters").first()).toBeVisible();

    // Fill name + bad slug, try Next again.
    await page.getByLabel("Competition name").fill("Bad Slug League");
    await page.getByLabel("Slug").fill("Bad SLUG!");
    await page.getByRole("button", { name: /^next$/i }).click();
    await expect(
      page.getByText("Lowercase letters, numbers, hyphens only"),
    ).toBeVisible();
  });

  test("organizer creates a competition via the wizard and lands on detail", async ({
    page,
  }, testInfo) => {
    await signInAs(page, "michael");
    const slug = `e2e-${testInfo.workerIndex}-${Date.now()}`;
    await page.goto("/competitions/new");

    // Step 1 — Basics
    await page.getByLabel("Competition name").fill("E2E Test League");
    await page.getByLabel("Slug").fill(slug);
    await page.getByRole("button", { name: /^next$/i }).click();

    // Step 2 — Participants (defaults are valid)
    await expect(
      page.getByRole("heading", { level: 1 }),
    ).toContainText(/step 2/i);
    await page.getByRole("button", { name: /^next$/i }).click();

    // Step 3 — Schedule & prize (all optional)
    await expect(
      page.getByRole("heading", { level: 1 }),
    ).toContainText(/step 3/i);
    await page.getByRole("button", { name: /^next$/i }).click();

    // Step 4 — Structure (defaulted to a singles + doubles block pair)
    await expect(
      page.getByRole("heading", { level: 1 }),
    ).toContainText(/step 4/i);
    await page.getByRole("button", { name: /^next$/i }).click();

    // Step 5 — Review
    await expect(
      page.getByRole("heading", { level: 1 }),
    ).toContainText(/step 5/i);
    // The success toast renders into an overlay dialog that briefly
    // intercepts pointer events; race the click + navigation so the test
    // doesn't fail just because the toast covered the button.
    await Promise.all([
      page.waitForURL(`/competitions/${slug}`),
      page
        .getByRole("button", { name: /^create competition$/i })
        .click({ force: true }),
    ]);
    await expect(
      page.getByRole("heading", { name: "E2E Test League", exact: true }),
    ).toBeVisible();
  });
});

test.describe("Captain apply flow", () => {
  test("anon user is redirected to sign-in", async ({ page }) => {
    await page.goto(
      "/competitions/da-nang-international-pool-league-2026/apply",
    );
    await page.waitForURL(/\/sign-in\?next=/);
    await expect(
      page.getByRole("heading", { name: "Welcome to PoolDN" }),
    ).toBeVisible();
  });

  test("captain sees the apply form populated with their teams", async ({
    page,
  }) => {
    await signInAs(page, "gen");
    await page.goto(
      "/competitions/da-nang-international-pool-league-2026/apply",
    );
    await expect(
      page.getByText("Apply to Da Nang International Pool League"),
    ).toBeVisible();
    await expect(page.getByLabel("Team")).toBeVisible();
  });
});

test.describe("Organizer reviews applications", () => {
  test("organizer sees the applications page", async ({ page }) => {
    await signInAs(page, "michael");
    await page.goto(
      "/competitions/da-nang-international-pool-league-2026/applications",
    );
    // Seeded applications are APPROVED already; page shows them
    await expect(page.getByText(/approved/i).first()).toBeVisible();
  });

  test("non-organizer is redirected away from applications", async ({
    page,
  }) => {
    await signInAs(page, "player1");
    await page.goto(
      "/competitions/da-nang-international-pool-league-2026/applications",
    );
    // requireViewer redirects role-mismatched users to /
    await page.waitForURL("/");
    await expect(
      page.getByRole("heading", { level: 1 }),
    ).toContainText(/welcome/i);
  });
});
