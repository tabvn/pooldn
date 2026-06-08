import { test, expect } from "@playwright/test";

test.describe("Teams directory", () => {
  test("team cards REALLY navigate when clicked (not synthetic)", async ({
    page,
  }) => {
    await page.goto("/teams");
    await expect(page.getByRole("heading", { name: "Teams" })).toBeVisible();

    // Click the card body via the test-id Link wrapper. We want to assert
    // the URL actually changes — a passing test that uses getByText().click()
    // can false-green because the inner text node is inside the anchor.
    await page
      .getByTestId("team-card-gen-filling-station")
      .click();

    await expect(page).toHaveURL("/teams/gen-filling-station");
    await expect(
      page.getByRole("heading", { name: "Gen Filling Station" }),
    ).toBeVisible();
    await expect(page.getByText("Roster")).toBeVisible();
  });

  test("team cards navigate when clicking on the card body (not text)", async ({
    page,
  }) => {
    await page.goto("/teams");
    const card = page.getByTestId("team-card-da-nang-tigers");
    await expect(card).toBeVisible();

    // Click the middle of the card to simulate a real-user click on
    // non-text card chrome (was the reported failure mode).
    const box = await card.boundingBox();
    if (!box) throw new Error("no card box");
    await page.mouse.click(box.x + box.width / 2, box.y + 10);

    await expect(page).toHaveURL("/teams/da-nang-tigers");
  });

  test("team detail renders captain badge", async ({ page }) => {
    await page.goto("/teams/gen-filling-station");
    await expect(page.getByText("Captain:")).toBeVisible();
  });
});

test.describe("Venues directory", () => {
  test("lists venues and links to detail", async ({ page }) => {
    await page.goto("/venues");
    await expect(page.getByRole("heading", { name: "Venues" })).toBeVisible();
    await expect(page.getByText("Pool Paradise")).toBeVisible();
    await page.getByText("Pool Paradise").first().click();
    await expect(page).toHaveURL("/venues/pool-paradise");
    await expect(
      page.getByRole("heading", { name: "Pool Paradise" }),
    ).toBeVisible();
    await expect(page.getByText("Contact")).toBeVisible();
  });
});

test.describe("Community", () => {
  test("renders the feed page (signed-out CTA)", async ({ page }) => {
    await page.goto("/community");
    await expect(
      page.getByRole("heading", { name: "Community" }),
    ).toBeVisible();
    // Signed-out viewers see the sign-in prompt in the compose strip.
    await expect(page.getByText(/sign in to post/i)).toBeVisible();
  });
});
