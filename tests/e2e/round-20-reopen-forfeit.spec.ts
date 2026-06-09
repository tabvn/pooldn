import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers";

const COMPLETED_SLUG = "da-nang-international-pool-league-2026";
const ONGOING_SLUG = "da-nang-autumn-invitational-2026";

test.describe("Round-20 · reopen + forfeit", () => {
  test("organizer reopens a COMPLETED competition (status flips back to ONGOING)", async ({
    page,
  }) => {
    await signInAs(page, "michael");
    // Capture original status, drive the reopen via GraphQL so the test isn't
    // brittle to dropdown timing, then assert status changed.
    const idRes = await page.request.post("/api/graphql", {
      data: {
        query: `query { competition(slug: "${COMPLETED_SLUG}") { id status } }`,
      },
    });
    const c = (await idRes.json()).data.competition;
    expect(c.status).toBe("COMPLETED");

    const reopenRes = await page.request.post("/api/graphql", {
      data: {
        query: `mutation R($id: ID!) { reopenCompetition(id: $id) { id status } }`,
        variables: { id: c.id },
      },
    });
    expect((await reopenRes.json()).data.reopenCompetition.status).toBe(
      "ONGOING",
    );

    // Reset to COMPLETED so the suite stays idempotent across re-runs.
    await page.request.post("/api/graphql", {
      data: {
        query: `mutation C($id: ID!) { completeCompetition(id: $id) { id status } }`,
        variables: { id: c.id },
      },
    });
  });

  test("organizer forfeits a match — opposing side wins by walkover", async ({
    page,
  }) => {
    await signInAs(page, "michael");
    const meta = await page.request.post("/api/graphql", {
      data: {
        query: `query { competition(slug: "${ONGOING_SLUG}") { matchdays { matches { id status homeTeam { id } awayTeam { id } } } } }`,
      },
    });
    type M = {
      id: string;
      status: string;
      homeTeam: { id: string } | null;
      awayTeam: { id: string } | null;
    };
    const match: M | undefined = (await meta.json()).data.competition.matchdays
      .flatMap((d: { matches: M[] }) => d.matches)
      .find(
        (m: M) =>
          m.status === "SCHEDULED" && m.homeTeam?.id && m.awayTeam?.id,
      );
    test.skip(!match, "no scheduled match available");
    const res = await page.request.post("/api/graphql", {
      data: {
        query: `mutation F($matchId: ID!, $forfeitingTeamId: ID!) {
          forfeitMatch(matchId: $matchId, forfeitingTeamId: $forfeitingTeamId, reason: "no show") {
            id status winType homeScore awayScore forfeitTeamId
          }
        }`,
        variables: { matchId: match!.id, forfeitingTeamId: match!.homeTeam!.id },
      },
    });
    const json = await res.json();
    expect(
      json.data?.forfeitMatch,
      `forfeit failed: ${JSON.stringify(json.errors)}`,
    ).toBeTruthy();
    const updated = json.data.forfeitMatch;
    expect(updated.status).toBe("COMPLETED");
    expect(updated.winType).toBe("WALKOVER");
    expect(updated.forfeitTeamId).toBe(match!.homeTeam!.id);
    expect(updated.awayScore).toBeGreaterThan(0);
  });
});
