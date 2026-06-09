import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("/admin/security opens and renders the log", async ({ page }) => {
  await signInAs(page, "toan");
  await page.goto("/admin/security", {
    waitUntil: "domcontentloaded",
    timeout: 25_000,
  });
  await expect(page.getByText(/Security log/i)).toBeVisible({ timeout: 15_000 });
  // The page renders a table even when empty — confirm the header
  // shows so we know SSR completed past requireViewer.
  await expect(page.getByRole("table")).toBeVisible();
});
