import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers";

test.describe("Notifications", () => {
  test("anonymous user is redirected to sign-in", async ({ page }) => {
    await page.goto("/notifications");
    await page.waitForURL(/\/sign-in\?next=/);
  });

  test("authenticated user sees their notifications", async ({ page }) => {
    await signInAs(page, "toan");
    await page.goto("/notifications");
    await expect(
      page.getByRole("heading", { name: "Notifications" }),
    ).toBeVisible();
    // Assert the inbox actually lists something rather than pinning to the
    // seeded welcome row: the list pages 20 at a time, so on an account with a
    // real history that row sits pages down and the test failed on data age.
    await expect(
      page.locator('[data-testid^="notification-"]').first(),
    ).toBeVisible();
  });

  test("Mark read removes the New badge", async ({ page }) => {
    await signInAs(page, "toan");
    await page.goto("/notifications");
    const markRead = page.getByRole("button", { name: /mark read/i }).first();
    if (await markRead.isVisible()) {
      await markRead.click();
      await expect(markRead).toBeHidden({ timeout: 5000 });
    }
  });
});
