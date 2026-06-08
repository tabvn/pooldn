import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers";

test.describe("CASL competition visibility", () => {
  test("anon viewer sees only published competitions (no DRAFT)", async ({
    page,
  }) => {
    await page.goto("/");
    const html = await page.content();
    expect(html).not.toContain("Toronto Bayside Cup"); // DRAFT, owner alex
    // None of the seeded e2e- slugs should appear either.
    expect(html).not.toMatch(/e2e-\d+-/);
  });

  test("organizer A does NOT see organizer B's DRAFT competition", async ({
    page,
  }) => {
    await signInAs(page, "michael"); // owns Da Nang comps
    const html = await page.content();
    expect(html).not.toContain("Toronto Bayside Cup");

    // Direct navigation to alex's DRAFT slug should not render its detail.
    const res = await page.goto(
      "/competitions/toronto-bayside-cup-2027",
    );
    // Either notFound (404) or redirected away — but never the title.
    const body = await page.content();
    expect(body).not.toContain("Toronto Bayside Cup");
    // Should be a 404 (Next renders 404 inside a 200 in dev; check status)
    expect([404, 200, 307].includes(res?.status() ?? 0)).toBeTruthy();
  });

  test("organizer B sees their own DRAFT on /competitions browse", async ({
    page,
  }) => {
    await signInAs(page, "alex");
    // Dashboard only surfaces Upcoming + Active; DRAFTs live on the browse
    // page with a status filter, where the organizer's own draft is visible.
    await page.goto("/competitions?status=DRAFT");
    await expect(page.getByText("Toronto Bayside Cup")).toBeVisible();
    await page.goto("/competitions/toronto-bayside-cup-2027");
    await expect(
      page.getByRole("heading", { name: "Toronto Bayside Cup" }),
    ).toBeVisible();
  });

  test("super-admin sees ALL competitions including drafts on browse", async ({
    page,
  }) => {
    await signInAs(page, "toan");
    await page.goto("/competitions?status=DRAFT");
    await expect(page.getByText("Toronto Bayside Cup")).toBeVisible();
  });
});
