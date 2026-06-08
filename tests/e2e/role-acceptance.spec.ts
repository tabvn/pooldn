import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers";

/**
 * Round-11/13/14 role acceptance matrix.
 *
 * Each block walks a role through the start→end UI surface they're entitled
 * to and proves they're blocked from disallowed paths. Public assertions
 * (button visibility, URL gating) avoid brittle mid-mutation timing.
 */

test.describe("Role acceptance · Guest", () => {
  test("guest sees public pages but is bounced from gated routes", async ({
    page,
  }) => {
    await page.goto("/competitions");
    await expect(
      page.getByRole("heading", { name: /competitions/i }),
    ).toBeVisible();

    await page.goto("/competitions/new");
    await page.waitForURL(/\/sign-in/);

    await page.goto("/notifications");
    await page.waitForURL(/\/sign-in/);

    await page.goto("/teams/new");
    await page.waitForURL(/\/sign-in/);
  });
});

test.describe("Role acceptance · Viewer", () => {
  test("viewer browses but cannot create competitions or teams", async ({
    page,
  }) => {
    await signInAs(page, "viewer");
    await expect(
      page.getByRole("link", { name: /create competition/i }),
    ).toHaveCount(0);
    await page.goto("/competitions/new");
    await page.waitForURL("/");
    await page.goto("/teams/new");
    await page.waitForURL("/");
  });
});

test.describe("Role acceptance · Player", () => {
  test("player can see dashboard + browse but no manager controls", async ({
    page,
  }) => {
    await signInAs(page, "player1");
    await expect(
      page.getByRole("link", { name: /create competition/i }),
    ).toHaveCount(0);
    await page.goto("/competitions/da-nang-autumn-invitational-2026");
    // Captain-only Apply CTA not shown for plain player.
    await expect(
      page.getByRole("button", { name: /apply with my team/i }),
    ).toHaveCount(0);
  });
});

test.describe("Role acceptance · Captain", () => {
  test("captain has Apply CTA on an OPEN comp and sees manage on their team", async ({
    page,
  }) => {
    await signInAs(page, "hai");
    await page.goto("/competitions/spring-open-2027");
    await expect(
      page.getByRole("link", { name: /apply with my team/i }),
    ).toBeVisible();
    await page.goto("/teams/hai-crew/manage");
    await expect(
      page.getByRole("heading", { name: /manage roster/i }),
    ).toBeVisible();
    // Invite + join requests sections exist (round-12 TASK 3).
    await expect(page.getByTestId("invite-card")).toBeVisible();
    await expect(page.getByTestId("join-requests-card")).toBeVisible();
  });
});

test.describe("Role acceptance · Organizer", () => {
  test("organizer sees Create CTA + lifecycle kebab on own comps + Edit on COMPLETED", async ({
    page,
  }) => {
    await signInAs(page, "michael");
    await expect(
      page.getByRole("link", { name: /create competition/i }),
    ).toBeVisible();
    // Edit kebab present on COMPLETED (round-12 TASK 2).
    await page.goto("/competitions/da-nang-international-pool-league-2026");
    await page.getByTestId("lifecycle-menu").click();
    await expect(
      page.getByRole("menuitem", { name: /edit details/i }),
    ).toBeVisible();
  });
});

test.describe("Role acceptance · Super Admin", () => {
  test("super-admin can edit anyone's competition", async ({ page }) => {
    await signInAs(page, "toan");
    // toan is SUPER_ADMIN; should reach the edit wizard for michael's comp.
    await page.goto(
      "/competitions/da-nang-autumn-invitational-2026/edit",
    );
    await expect(
      page.getByText(/edit competition/i).first(),
    ).toBeVisible();
  });
});
