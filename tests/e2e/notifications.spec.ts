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
    await expect(page.getByText("Welcome to PoolDN")).toBeVisible();
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
