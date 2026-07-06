import { test, expect } from "@playwright/test";

test.describe("Shell navigation", () => {
  test("sidebar links navigate to each section", async ({ page }) => {
    await page.goto("/");
    // Poolhub link goes to /
    await page.getByRole("link", { name: "Poolhub" }).click();
    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { level: 1 }),
    ).toContainText(/welcome/i);

    await page.getByRole("link", { name: "Teams" }).click();
    await expect(page).toHaveURL("/teams");
    await expect(
      page.getByRole("heading", { name: /^Teams( in .+)?$/ }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Venues" }).click();
    await expect(page).toHaveURL("/venues");
    await expect(page.getByRole("heading", { name: "Venues" })).toBeVisible();

    await page.getByRole("link", { name: "Community" }).click();
    await expect(page).toHaveURL("/community");
    await expect(
      page.getByRole("heading", { name: "Community" }),
    ).toBeVisible();
  });

  test("header notification bell opens popover, View all → /notifications", async ({
    page,
  }) => {
    // Round-11 — the bell is now a popover trigger with a "View all"
    // footer link, not a plain anchor. Verify the new flow.
    await page.goto("/sign-in");
    await page.getByTestId("demo-login-toan").click();
    await page.waitForURL("/");
    await page.getByTestId("notification-bell").click();
    await expect(page.getByTestId("notification-popover")).toBeVisible();
    await page
      .getByTestId("notification-popover")
      .getByRole("link", { name: /view all/i })
      .click();
    await expect(page).toHaveURL(/\/notifications/);
  });
});
