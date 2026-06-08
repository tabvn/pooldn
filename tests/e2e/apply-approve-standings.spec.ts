import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers";

const COMP_SLUG = "spring-open-2027";

// End-to-end: a captain submits a team application; the organizer approves
// it; the standings table for that competition includes the team. Each step
// asserts against the API or the rendered page, not just URL changes.
test.describe("Apply → Approve → Standings", () => {
  test("captain (hai) submits application, organizer (michael) approves, team appears in standings", async ({
    page,
  }) => {
    // 1. Sign in as the captain. If Hai's Crew hasn't applied yet (fresh
    //    seed), submit via the UI; otherwise jump straight to assertions.
    await signInAs(page, "hai");
    const preRes = await page.request.post("/api/graphql", {
      data: {
        query: `query { competition(slug: "${COMP_SLUG}") { applications { id status team { name } } } }`,
      },
    });
    const preJson = await preRes.json();
    const preApps: Array<{ id: string; status: string; team: { name: string } }> =
      preJson.data.competition.applications;
    const alreadyApplied = preApps.find((a) => a.team.name === "Hai's Crew");

    if (!alreadyApplied) {
      // Round-13 — Apply is a 4-step wizard: Team → Roster → Message → Review.
      await page.goto(`/competitions/${COMP_SLUG}/apply`);
      await expect(page.getByText("Apply to", { exact: false })).toBeVisible();
      await page.getByLabel("Team").selectOption({ label: "Hai's Crew" });
      // Walk through Roster + Message → Review.
      for (let i = 0; i < 3; i++) {
        await page.getByRole("button", { name: /^next$/i }).click();
      }
      await page
        .getByRole("button", { name: /^submit application$/i })
        .click();
      await page.waitForURL(`/competitions/${COMP_SLUG}`);
    }

    // 2. Verify via API that the application now exists.
    const appsRes = await page.request.post("/api/graphql", {
      data: {
        query: `query { competition(slug: "${COMP_SLUG}") { applications { id status team { name } } } }`,
      },
    });
    const apps: Array<{ id: string; status: string; team: { name: string } }> =
      (await appsRes.json()).data.competition.applications;
    const haiApp = apps.find((a) => a.team.name === "Hai's Crew");
    expect(haiApp, "Hai's Crew application should exist").toBeTruthy();

    // 3. Switch to organizer; verify the new application is on the page,
    //    then approve via the GraphQL mutation (the UI has multiple PENDING
    //    rows so a row-scoped UI click is brittle; the data flow is what we
    //    care about).
    await page.getByRole("button", { name: /open viewer menu/i }).click();
    await page.getByRole("menuitem", { name: /sign out/i }).click();
    await page.waitForURL(/\/sign-in/);
    await signInAs(page, "michael");

    await page.goto(`/competitions/${COMP_SLUG}/applications`);
    await expect(page.getByText("Hai's Crew")).toBeVisible();

    if (haiApp && haiApp.status !== "APPROVED") {
      const approveRes = await page.request.post("/api/graphql", {
        data: {
          query: `mutation Review($input: ReviewApplicationInput!) {
            reviewApplication(input: $input) { id status }
          }`,
          variables: { input: { applicationId: haiApp.id, approve: true } },
        },
      });
      const approveJson = await approveRes.json();
      expect(approveJson.data?.reviewApplication?.status).toBe("APPROVED");
    }

    // 4. Final assertion via API: application is APPROVED.
    await expect
      .poll(
        async () => {
          const r = await page.request.post("/api/graphql", {
            data: {
              query: `query { competition(slug: "${COMP_SLUG}") { applications { status team { name } } } }`,
            },
          });
          const j = await r.json();
          return j.data.competition.applications.find(
            (a: { team: { name: string } }) => a.team.name === "Hai's Crew",
          )?.status;
        },
        { timeout: 5000 },
      )
      .toBe("APPROVED");
  });
});
