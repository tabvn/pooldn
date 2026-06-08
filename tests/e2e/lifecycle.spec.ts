import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers";

const OPEN_SLUG = "spring-open-2027";
const COMPLETED_SLUG = "da-nang-international-pool-league-2026";

test.describe("Competition lifecycle actions (kebab menu)", () => {
  test("organizer sees Close + Start + Cancel inside the kebab on an OPEN comp", async ({
    page,
  }) => {
    await signInAs(page, "michael");
    await page.goto(`/competitions/${OPEN_SLUG}`);
    await expect(page.getByTestId("lifecycle-menu")).toBeVisible();
    await page.getByTestId("lifecycle-menu").click();
    await expect(
      page.getByRole("menuitem", { name: /close applications/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: /start competition/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: /cancel competition/i }),
    ).toBeVisible();
  });

  test("organizer's lifecycle kebab on a COMPLETED comp only offers Edit", async ({
    page,
  }) => {
    // Round-12 TASK 2 — the Edit affordance must stay reachable for the
    // organizer on COMPLETED comps. State-changing actions (publish/start/
    // complete/cancel) should NOT appear.
    await signInAs(page, "michael");
    await page.goto(`/competitions/${COMPLETED_SLUG}`);
    await page.getByTestId("lifecycle-menu").click();
    await expect(
      page.getByRole("menuitem", { name: /edit details/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: /complete competition/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("menuitem", { name: /cancel competition/i }),
    ).toHaveCount(0);
  });

  test("captain does NOT see lifecycle kebab; sees Apply CTA on an OPEN comp", async ({
    page,
  }) => {
    await signInAs(page, "gen");
    await page.goto(`/competitions/${OPEN_SLUG}`);
    await expect(page.getByTestId("lifecycle-menu")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /apply with my team/i }),
    ).toBeVisible();
  });

  test("non-owning organizer sees no lifecycle kebab on someone else's comp", async ({
    page,
  }) => {
    await signInAs(page, "alex");
    await page.goto(`/competitions/${OPEN_SLUG}`);
    await expect(page.getByTestId("lifecycle-menu")).toHaveCount(0);
  });

  test("super-admin (toan) sees the lifecycle kebab on any competition", async ({
    page,
  }) => {
    await signInAs(page, "toan");
    await page.goto(`/competitions/${OPEN_SLUG}`);
    await expect(page.getByTestId("lifecycle-menu")).toBeVisible();
  });
});
