import { test, expect, type Page } from "@playwright/test";
import { signInAs, type DemoRole } from "./helpers";

const COMP_SLUG = "da-nang-international-pool-league-2026";
const OPEN_COMP_SLUG = "spring-open-2027";

// What each role should see/not see across the app. Use this matrix to
// systematically verify role gating. Keep assertions narrow so any one
// failure points at the offending page.

/**
 * Round-89 — this matrix is the app's CURRENT model, not the original one:
 *
 *  - Any signed-in user may organize a competition (Round-47; see the comment
 *    in app/(shell)/competitions/new/page.tsx and `can("create", "Competition")`
 *    for every signed-in branch of lib/casl/ability.ts). So the create CTA and
 *    /competitions/new are open to all roles here, not just ORGANIZER+.
 *  - A non-manager opening a competition's Applications tab gets the read-only
 *    confirmed list rather than a redirect (Round-60).
 *  - /apply loads for any signed-in role; whether they may actually apply is
 *    gated server-side by Competition.viewerCanApply.
 */
const matrix: Record<
  DemoRole,
  {
    name: string;
    canSeeCreateCTA: boolean;
    canVisitNewCompetition: boolean;
    canVisitApplications: boolean;
    canVisitApply: boolean;
  }
> = {
  toan: {
    name: "Toan Nguyen",
    canSeeCreateCTA: true,
    canVisitNewCompetition: true,
    canVisitApplications: true,
    canVisitApply: true, // admin redirected to /, but allowed by role array
  },
  michael: {
    name: "Michael Dibbson",
    canSeeCreateCTA: true,
    canVisitNewCompetition: true,
    canVisitApplications: true,
    // michael ORGANIZES the competition this test applies to (spring-open-2027),
    // and an organizer can't enter their own — the apply route bounces them.
    canVisitApply: false,
  },
  alex: {
    name: "Alex Reid",
    canSeeCreateCTA: true,
    canVisitNewCompetition: true,
    // alex IS an organizer (passes role check) — but doesn't own michael's
    // competitions, so the page loads but renders empty. The CASL filter
    // does the work; the role-only redirect lets him through.
    canVisitApplications: true,
    canVisitApply: true,
  },
  thomas: {
    name: "Thomas Bryan",
    canSeeCreateCTA: true,
    canVisitNewCompetition: true,
    canVisitApplications: true,
    canVisitApply: true,
  },
  gen: {
    name: "Gen Hoang",
    canSeeCreateCTA: true,
    canVisitNewCompetition: true,
    canVisitApplications: true,
    canVisitApply: true,
  },
  hai: {
    name: "Hai Le",
    canSeeCreateCTA: true,
    canVisitNewCompetition: true,
    canVisitApplications: true,
    canVisitApply: true,
  },
  // Round-69 demo captains — same gating as the other team captains.
  long: {
    name: "Long Duong",
    canSeeCreateCTA: true,
    canVisitNewCompetition: true,
    canVisitApplications: true,
    canVisitApply: true,
  },
  duc: {
    name: "Duc Tran",
    canSeeCreateCTA: true,
    canVisitNewCompetition: true,
    canVisitApplications: true,
    canVisitApply: true,
  },
  kenji: {
    name: "Kenji Sato",
    canSeeCreateCTA: true,
    canVisitNewCompetition: true,
    canVisitApplications: true,
    canVisitApply: true,
  },
  sofia: {
    name: "Sofia Garcia",
    canSeeCreateCTA: true,
    canVisitNewCompetition: true,
    canVisitApplications: true,
    canVisitApply: true,
  },
  raj: {
    name: "Raj Patel",
    canSeeCreateCTA: true,
    canVisitNewCompetition: true,
    canVisitApplications: true,
    canVisitApply: true,
  },
  player1: {
    name: "Linh Tran",
    canSeeCreateCTA: true,
    canVisitNewCompetition: true,
    canVisitApplications: true,
    canVisitApply: true,
  },
  player2: {
    name: "An Pham",
    canSeeCreateCTA: true,
    canVisitNewCompetition: true,
    canVisitApplications: true,
    canVisitApply: true,
  },
  viewer: {
    name: "Viewer Demo",
    // Round-90 — VIEWER is the read-only persona: no create CTA, and
    // /competitions/new redirects.
    canSeeCreateCTA: false,
    canVisitNewCompetition: false,
    canVisitApplications: true,
    canVisitApply: true,
  },
};

async function walkPublicPages(page: Page, displayName: string) {
  // Each role should successfully traverse the public-read shell.
  const firstName = displayName.split(/\s+/)[0];

  await page.goto("/");
  // Dashboard greets the signed-in viewer; header shows "First L.".
  await expect(
    page.getByRole("heading", { level: 1 }),
  ).toContainText(/welcome/i);
  await expect(page.getByText(firstName).first()).toBeVisible();

  await page.goto("/teams");
  await expect(
    page.getByRole("heading", { name: /^Teams( in .+)?$/ }),
  ).toBeVisible();
  await expect(page.getByText("Gen Filling Station")).toBeVisible();

  await page.goto("/venues");
  await expect(page.getByRole("heading", { name: "Venues" })).toBeVisible();

  await page.goto("/community");
  await expect(
    page.getByRole("heading", { name: "Community" }),
  ).toBeVisible();

  await page.goto(`/competitions/${COMP_SLUG}`);
  await expect(page.getByText("League Standings")).toBeVisible();
}

for (const [role, spec] of Object.entries(matrix) as Array<
  [DemoRole, typeof matrix.toan]
>) {
  test.describe(`Role walk — ${role} (${spec.name})`, () => {
    test("public pages render with viewer identity in the header", async ({
      page,
    }) => {
      await signInAs(page, role);
      await walkPublicPages(page, spec.name);
    });

    test("Create competition CTA visibility matches role", async ({ page }) => {
      await signInAs(page, role);
      const cta = page.getByRole("link", { name: /create competition/i });
      if (spec.canSeeCreateCTA) {
        await expect(cta).toBeVisible();
      } else {
        await expect(cta).toHaveCount(0);
      }
    });

    test("/competitions/new access matches role", async ({ page }) => {
      await signInAs(page, role);
      await page.goto("/competitions/new");
      if (spec.canVisitNewCompetition) {
        await expect(page).toHaveURL("/competitions/new");
        await expect(
          page.getByRole("heading", { level: 1 }),
        ).toContainText(/create new competition/i);
      } else {
        // requireViewer redirects to /
        await expect(page).toHaveURL("/");
      }
    });

    test("/competitions/[slug]/applications access matches role", async ({
      page,
    }) => {
      await signInAs(page, role);
      await page.goto(`/competitions/${COMP_SLUG}/applications`);
      if (spec.canVisitApplications) {
        await expect(page).toHaveURL(
          `/competitions/${COMP_SLUG}/applications`,
        );
      } else {
        await expect(page).toHaveURL("/");
      }
    });

    test("/competitions/[slug]/apply access matches role", async ({ page }) => {
      await signInAs(page, role);
      await page.goto(`/competitions/${OPEN_COMP_SLUG}/apply`);
      if (spec.canVisitApply) {
        // Captain + admin both pass role check; admin gets redirected by the
        // `roles` allowlist actually permits them (we keep both).
        await expect(page).toHaveURL(
          `/competitions/${OPEN_COMP_SLUG}/apply`,
        );
      } else {
        await expect(page).toHaveURL("/");
      }
    });

    test("notifications inbox is accessible while signed in", async ({
      page,
    }) => {
      await signInAs(page, role);
      await page.goto("/notifications");
      await expect(
        page.getByRole("heading", { name: "Notifications" }),
      ).toBeVisible();
    });

    test("sign out clears session and lands on /sign-in", async ({ page }) => {
      await signInAs(page, role);
      await page.getByRole("button", { name: /open viewer menu/i }).click(); await page.getByRole("menuitem", { name: /sign out/i }).click();
      await page.waitForURL(/\/sign-in/);
      await expect(
        page.getByRole("heading", { name: "Welcome to PoolDN" }),
      ).toBeVisible();
    });
  });
}
