import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers";

const OPEN_SLUG = "spring-open-2027";
const ONGOING_SLUG = "da-nang-autumn-invitational-2026";

test.describe("Round-10 A · roster uniqueness across teams", () => {
  test("API rejects a second team registering an already-rostered player in the same competition", async ({
    page,
  }) => {
    // 1. Sign in as Gen (captain of Gen Filling Station + Pool Sharks).
    await signInAs(page, "gen");

    // 2. Find Gen's two teams + a player on Gen Filling Station's roster.
    const meta = await page.request.post("/api/graphql", {
      data: {
        query: `query { teams { id name slug members { user { id name username } } } competition(slug: "${OPEN_SLUG}") { id status applications { id status team { id name } } } }`,
      },
    });
    const m = await meta.json();
    const genFS = m.data.teams.find(
      (t: { name: string }) => t.name === "Gen Filling Station",
    );
    const sharks = m.data.teams.find(
      (t: { name: string }) => t.name === "Pool Sharks",
    );
    const p1 = genFS.members[0].user;
    const competitionId: string = m.data.competition.id;

    // Setup — clean slate for Gen FS so we can re-apply it WITH players.
    const existing = m.data.competition.applications.find(
      (a: { team: { id: string }; status: string }) =>
        a.team.id === genFS.id && a.status !== "CANCELLED",
    );
    if (existing) {
      await page.request.post("/api/graphql", {
        data: {
          query: `mutation W($id: ID!) { withdrawApplication(id: $id) { id status } }`,
          variables: { id: existing.id },
        },
      });
    }
    // Same for Sharks (the seed has it CANCELLED but the @@unique still binds).
    const existingSharks = m.data.competition.applications.find(
      (a: { team: { id: string }; status: string }) => a.team.id === sharks.id,
    );
    if (existingSharks && existingSharks.status !== "CANCELLED") {
      await page.request.post("/api/graphql", {
        data: {
          query: `mutation W($id: ID!) { withdrawApplication(id: $id) { id status } }`,
          variables: { id: existingSharks.id },
        },
      });
    }
    // Drop the CANCELLED Sharks app via direct delete-on-status — applyToCompetition
    // hits @@unique([competitionId,teamId]). We rely on prisma seed cleanup to do this.
    // If a stale CANCELLED app blocks us, reuse it by trying applyToCompetition and
    // tolerate "applied"-style errors.

    // Step A — apply Gen FS with p1.
    const apply1 = await page.request.post("/api/graphql", {
      data: {
        query: `mutation A($input: ApplyToCompetitionInput!) {
          applyToCompetition(input: $input) { id }
        }`,
        variables: {
          input: { competitionId, teamId: genFS.id, playerUserIds: [p1.id] },
        },
      },
    });
    const apply1Json = await apply1.json();
    expect(
      apply1Json.errors?.[0]?.message,
      `Gen FS apply unexpectedly failed: ${apply1Json.errors?.[0]?.message ?? ""}`,
    ).toBeUndefined();

    // Step B — apply Pool Sharks with the SAME p1. MUST be blocked.
    const apply2 = await page.request.post("/api/graphql", {
      data: {
        query: `mutation A($input: ApplyToCompetitionInput!) {
          applyToCompetition(input: $input) { id }
        }`,
        variables: {
          input: { competitionId, teamId: sharks.id, playerUserIds: [p1.id] },
        },
      },
    });
    const apply2Json = await apply2.json();
    expect(apply2Json.errors?.[0]?.message ?? "").toMatch(/already on/i);
  });
});

test.describe("Round-10 B · dual-captain score submission", () => {
  test("matching scores from both captains auto-approve and complete the match", async ({
    page,
  }) => {
    // The ongoing competition has 3 captains: thomas (Tigers), gen (Gen FS),
    // hai (Hai's Crew). Find any SCHEDULED match between two of them.
    await signInAs(page, "michael");
    const all = await page.request.post("/api/graphql", {
      data: {
        query: `query { competition(slug: "${ONGOING_SLUG}") {
          id matchdays { id matches { id status homeTeam { id name captain { id username } } awayTeam { id name captain { id username } } } }
        } }`,
      },
    });
    const c = (await all.json()).data.competition;
    type M = {
      id: string;
      status: string;
      homeTeam: { id: string; name: string; captain: { id: string; username: string } } | null;
      awayTeam: { id: string; name: string; captain: { id: string; username: string } } | null;
    };
    // SCHEDULED matches have no prior submissions — the IN_PROGRESS one in
    // the seed carries a deliberate CONFLICT to exercise the conflict UI.
    const candidates: M[] = c.matchdays
      .flatMap((md: { matches: M[] }) => md.matches)
      .filter(
        (m: M) =>
          m.status === "SCHEDULED" &&
          m.homeTeam?.captain &&
          m.awayTeam?.captain,
      );
    test.skip(candidates.length === 0, "no schedulable match for round-10 test");
    const match = candidates[0]!;
    const homeCaptain = match.homeTeam!.captain.username;
    const awayCaptain = match.awayTeam!.captain.username;

    // Sign in as home captain, submit a score via the API.
    await signInAs(page, homeCaptain as never);
    const s1 = await page.request.post("/api/graphql", {
      data: {
        query: `mutation S($input: SubmitMatchScoreInput!) {
          submitMatchScore(input: $input) { id status }
        }`,
        variables: { input: { matchId: match.id, homeScore: 5, awayScore: 3 } },
      },
    });
    const s1Json = await s1.json();
    expect(s1Json.data?.submitMatchScore?.status).toBe("PENDING");

    // Sign out, sign in as away captain, submit the SAME score.
    await page.getByRole("button", { name: /open viewer menu/i }).click();
    await page.getByRole("menuitem", { name: /sign out/i }).click();
    await page.waitForURL(/\/sign-in/);
    await signInAs(page, awayCaptain as never);
    const s2 = await page.request.post("/api/graphql", {
      data: {
        query: `mutation S($input: SubmitMatchScoreInput!) {
          submitMatchScore(input: $input) { id status }
        }`,
        variables: { input: { matchId: match.id, homeScore: 5, awayScore: 3 } },
      },
    });
    const s2Json = await s2.json();
    expect(s2Json.data?.submitMatchScore?.status).toBe("AUTO_APPROVED");

    // Match is now COMPLETED with the agreed score.
    const verify = await page.request.post("/api/graphql", {
      data: { query: `query { match(id: "${match.id}") { status homeScore awayScore } }` },
    });
    const v = (await verify.json()).data.match;
    expect(v.status).toBe("COMPLETED");
    expect(v.homeScore).toBe(5);
    expect(v.awayScore).toBe(3);
  });
});
