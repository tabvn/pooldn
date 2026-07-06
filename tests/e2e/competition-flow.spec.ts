import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers";

test.describe("Competition lifecycle (organizer)", () => {
  test("organizer sees Create competition CTA and can publish", async ({
    page,
  }) => {
    await signInAs(page, "michael");
    await page.goto("/competitions");
    await expect(
      page.getByRole("link", { name: /create competition/i }),
    ).toBeVisible();
  });

  test("create-basics screen requires a name before submitting", async ({
    page,
  }) => {
    await signInAs(page, "michael");
    await page.goto("/competitions/new");

    // The Figma basics card defaults Game/Format/Tournament to valid values
    // so the only required field the captain has to touch is the name.
    await page.getByTestId("basics-create").click();
    await expect(
      page.getByText(/give your competition a name/i),
    ).toBeVisible();
  });

  test(
    "organizer creates a competition from the basics screen and lands on the tab editor",
    async ({ page }, testInfo) => {
      await signInAs(page, "michael");
      const suffix = `${testInfo.workerIndex}-${Date.now()}`;
      const name = `E2E Test League ${suffix}`;

      await page.goto("/competitions/new");
      await page.getByTestId("basics-name").fill(name);
      await page.getByTestId("basics-startdate").fill("2027-09-01");
      await page.getByTestId("basics-create").click();

      // Lands on the tabbed draft editor. Slug is auto-generated.
      await page.waitForURL(/\/competitions\/[^/]+\/edit$/);

      // Opens on the Details tab, prefilled with the new name.
      await expect(page.getByTestId("details-name")).toHaveValue(name);

      // Fill the tabs end-to-end and publish.
      await page.getByTestId("edit-tab-participants").click();
      await page.getByTestId("participants-max-teams").fill("8");
      await page.getByTestId("participants-min-players").fill("3");
      await page.getByTestId("participants-max-players").fill("6");
      await page.getByTestId("edit-save").click();

      await page.getByTestId("edit-tab-schedule").click();
      await page.getByTestId("schedule-add-weekday").click();
      await page.getByTestId("edit-save").click();

      await page.getByTestId("edit-tab-structure").click();
      await page.getByRole("button", { name: /^\s*singles\s*$/i }).click();
      await page.getByRole("button", { name: /^\s*doubles\s*$/i }).click();
      await page.getByTestId("edit-save").click();

      await page.getByTestId("edit-tab-review").click();
      const publish = page.getByTestId("edit-publish");
      await expect(publish).toBeEnabled();
      await publish.click();

      // Publish transitions DRAFT → OPEN_FOR_APPLICATIONS and redirects.
      await page.waitForURL(/\/competitions\/[^/]+$/);
      await expect(
        page.getByRole("heading", { name, exact: true }),
      ).toBeVisible();
    },
  );
});
