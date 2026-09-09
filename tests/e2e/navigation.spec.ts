import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers";

test.describe("Shell navigation", () => {
  test("sidebar links navigate to each section", async ({ page }) => {
    await page.goto("/");
    // Scope every hop to the sidebar: competition cards on the dashboard carry
    // "Teams" in their accessible name (the format chip), which makes a bare
    // role query ambiguous under strict mode.
    const sidebar = page.getByRole("complementary");
    // Poolhub link goes to /
    await sidebar.getByRole("link", { name: "Poolhub" }).click();
    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { level: 1 }),
    ).toContainText(/welcome/i);

    await sidebar.getByRole("link", { name: "Teams", exact: true }).click();
    await expect(page).toHaveURL("/teams");
    await expect(
      page.getByRole("heading", { name: /^Teams( in .+)?$/ }),
    ).toBeVisible();

    await sidebar.getByRole("link", { name: "Venues", exact: true }).click();
    await expect(page).toHaveURL("/venues");
    await expect(page.getByRole("heading", { name: "Venues" })).toBeVisible();

    await sidebar.getByRole("link", { name: "Community", exact: true }).click();
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
    await signInAs(page, "toan");
    await page.getByTestId("notification-bell").click();
    await expect(page.getByTestId("notification-popover")).toBeVisible();
    await page
      .getByTestId("notification-popover")
      .getByRole("link", { name: /view all/i })
      .click();
    await expect(page).toHaveURL(/\/notifications/);
  });
});
