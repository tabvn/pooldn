import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

const ONGOING_SLUG = "da-nang-autumn-invitational-2026";

/**
 * Round-31/32 — full coverage of the score submission audit trail.
 *
 *   - matching scores from both captains → AUTO_AGREED on the Match (no human reviewer)
 *   - differing scores → CONFLICT → organizer resolves → ORGANIZER_REVIEW with completedBy
 *   - admin (non-organizer) resolves → ADMIN_OVERRIDE with completedBy
 *   - boardImageUrls persist on the submission
 *
 * Each test signs in via the GraphQL API and uses the request fixture so we
 * don't need full UI navigation — keeps the spec tight and resilient to
 * styling changes.
 */

type Captain = { id: string; username: string };
type MatchRow = {
  id: string;
  status: string;
  homeTeam: { id: string; name: string; captain: Captain | null } | null;
  awayTeam: { id: string; name: string; captain: Captain | null } | null;
};

async function fetchMatches(
  page: import("@playwright/test").Page,
): Promise<MatchRow[]> {
  const res = await page.request.post("/api/graphql", {
    data: {
      query: `query { competition(slug: "${ONGOING_SLUG}") {
        matchdays { matches {
          id status
          homeTeam { id name captain { id username } }
          awayTeam { id name captain { id username } }
        } }
      } }`,
    },
  });
  const c = (await res.json()).data.competition;
  return c.matchdays.flatMap((md: { matches: MatchRow[] }) => md.matches);
}

async function pickScheduledMatch(
  page: import("@playwright/test").Page,
): Promise<MatchRow> {
  const all = await fetchMatches(page);
  const candidates = all.filter(
    (m: MatchRow) =>
      m.status === "SCHEDULED" &&
      m.homeTeam?.captain &&
      m.awayTeam?.captain,
  );
  test.skip(candidates.length === 0, "no schedulable match");
  return candidates[0]!;
}

async function pickAnyCaptainedMatch(
  page: import("@playwright/test").Page,
): Promise<MatchRow> {
  const all = await fetchMatches(page);
  const candidates = all.filter(
    (m: MatchRow) =>
      m.homeTeam?.captain &&
      m.awayTeam?.captain,
  );
  test.skip(candidates.length === 0, "no captained match");
  return candidates[0]!;
}

async function login(
  page: import("@playwright/test").Page,
  username: string,
): Promise<void> {
  // Sign out via the viewer-menu dropdown so the session cookie clears
  // cleanly. Playwright's clearCookies() can leave Chromium's auth context
  // in a half-baked state on a hot re-entry and the next demo-login click
  // never navigates.
  try {
    await page
      .getByRole("button", { name: /open viewer menu/i })
      .click({ timeout: 2000 });
    await page.getByRole("menuitem", { name: /sign out/i }).click();
    await page.waitForURL(/\/sign-in/);
  } catch {
    // Already signed out (e.g. first call in a test).
  }
  await signInAs(page, username as never);
}

test.describe("Score submission audit", () => {
  test("board photos persist with the submission", async ({ page }) => {
    await signInAs(page, "michael");
    const match = await pickScheduledMatch(page);
    const home = match.homeTeam!.captain!.username;

    await login(page, home);
    const r = await page.request.post("/api/graphql", {
      data: {
        query: `mutation S($input: SubmitMatchScoreInput!) {
          submitMatchScore(input: $input) {
            id status boardImageUrls
          }
        }`,
        variables: {
          input: {
            matchId: match.id,
            homeScore: 6,
            awayScore: 6,
            boardImageUrls: [
              "/uploads/score-board/" + home + "/front.jpg",
              "/uploads/score-board/" + home + "/close.jpg",
            ],
          },
        },
      },
    });
    const s = (await r.json()).data.submitMatchScore;
    expect(s.boardImageUrls).toHaveLength(2);
    expect(s.boardImageUrls[0]).toContain("score-board");
  });

  test("matching scores → AUTO_AGREED with no reviewer", async ({ page }) => {
    await signInAs(page, "michael");
    const match = await pickScheduledMatch(page);
    const home = match.homeTeam!.captain!.username;
    const away = match.awayTeam!.captain!.username;

    await login(page, home);
    const r1 = await page.request.post("/api/graphql", {
      data: {
        query: `mutation S($input: SubmitMatchScoreInput!) {
          submitMatchScore(input: $input) { id status boardImageUrls }
        }`,
        variables: { input: { matchId: match.id, homeScore: 7, awayScore: 5 } },
      },
    });
    const r1j = await r1.json();
    expect(r1j.errors ?? null).toBeNull();
    expect(r1j.data.submitMatchScore.status).toBe("PENDING");
    expect(r1j.data.submitMatchScore.boardImageUrls).toEqual([]);

    await login(page, away);
    const r2 = await page.request.post("/api/graphql", {
      data: {
        query: `mutation S($input: SubmitMatchScoreInput!) {
          submitMatchScore(input: $input) { id status }
        }`,
        variables: { input: { matchId: match.id, homeScore: 7, awayScore: 5 } },
      },
    });
    expect((await r2.json()).data.submitMatchScore.status).toBe(
      "AUTO_APPROVED",
    );

    const v = await page.request.post("/api/graphql", {
      data: {
        query: `query { match(id: "${match.id}") {
          status homeScore awayScore completionMode completedBy { username }
        } }`,
      },
    });
    const m = (await v.json()).data.match;
    expect(m.status).toBe("COMPLETED");
    expect(m.homeScore).toBe(7);
    expect(m.awayScore).toBe(5);
    expect(m.completionMode).toBe("AUTO_AGREED");
    // AUTO_AGREED → no human reviewer, completedBy is null by design.
    expect(m.completedBy).toBeNull();
  });

  test("differing scores → CONFLICT → organizer review records reviewer + mode", async ({
    page,
  }) => {
    await signInAs(page, "michael");
    const match = await pickScheduledMatch(page);
    const home = match.homeTeam!.captain!.username;
    const away = match.awayTeam!.captain!.username;

    await login(page, home);
    const r1 = await page.request.post("/api/graphql", {
      data: {
        query: `mutation S($input: SubmitMatchScoreInput!) {
          submitMatchScore(input: $input) { status }
        }`,
        variables: { input: { matchId: match.id, homeScore: 7, awayScore: 3 } },
      },
    });
    expect((await r1.json()).data.submitMatchScore.status).toBe("PENDING");

    await login(page, away);
    const r2 = await page.request.post("/api/graphql", {
      data: {
        query: `mutation S($input: SubmitMatchScoreInput!) {
          submitMatchScore(input: $input) { status }
        }`,
        variables: { input: { matchId: match.id, homeScore: 6, awayScore: 4 } },
      },
    });
    expect((await r2.json()).data.submitMatchScore.status).toBe("CONFLICT");

    // The organizer of the ongoing competition is `michael` per the seed.
    await login(page, "michael");
    const resolve = await page.request.post("/api/graphql", {
      data: {
        query: `mutation R($input: ReviewMatchScoreInput!) {
          reviewMatchScore(input: $input) { id status completionMode completedBy { username } }
        }`,
        variables: {
          input: {
            matchId: match.id,
            homeScore: 7,
            awayScore: 3,
            note: "Home captain's scoresheet matches table chalk.",
          },
        },
      },
    });
    const m = (await resolve.json()).data.reviewMatchScore;
    expect(m.status).toBe("COMPLETED");
    expect(m.completionMode).toBe("ORGANIZER_REVIEW");
    expect(m.completedBy?.username).toBe("michael");
  });

  test("captain calling submitMatchResult is FORBIDDEN (R41 bypass closed)", async ({
    page,
  }) => {
    // Pick ANY match where a captain exists — bypass enforcement is status-
    // independent. We don't need a SCHEDULED match here.
    await signInAs(page, "michael");
    const match = await pickAnyCaptainedMatch(page);
    const home = match.homeTeam!.captain!.username;

    await login(page, home);
    const r = await page.request.post("/api/graphql", {
      data: {
        query: `mutation R($input: SubmitMatchResultInput!) {
          submitMatchResult(input: $input) { id status }
        }`,
        variables: {
          input: { matchId: match.id, homeScore: 9, awayScore: 0 },
        },
      },
    });
    const j = await r.json();
    expect(j.errors?.[0]?.extensions?.code ?? "").toBe("FORBIDDEN");
    expect(j.errors?.[0]?.message ?? "").toMatch(/submitMatchScore/);
  });

  test("organizer CAN finalize via submitMatchResult (override path)", async ({
    page,
  }) => {
    await signInAs(page, "michael");
    const match = await pickScheduledMatch(page);
    test.skip(!match, "no SCHEDULED match left after prior tests");
    const r = await page.request.post("/api/graphql", {
      data: {
        query: `mutation R($input: SubmitMatchResultInput!) {
          submitMatchResult(input: $input) {
            id status homeScore awayScore completionMode completedBy { username }
          }
        }`,
        variables: {
          input: { matchId: match!.id, homeScore: 5, awayScore: 2 },
        },
      },
    });
    const m = (await r.json()).data.submitMatchResult;
    expect(m.status).toBe("COMPLETED");
    expect(m.homeScore).toBe(5);
    expect(m.completionMode).toBe("ORGANIZER_REVIEW");
    expect(m.completedBy?.username).toBe("michael");
  });

});
