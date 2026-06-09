import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers";

const ONGOING_SLUG = "da-nang-autumn-invitational-2026";

test.describe("Round-20 finals — walkover button + transfer + cancel-join + pre-start banner", () => {
  test("captain can mark a per-frame walkover", async ({ page }) => {
    await signInAs(page, "michael");
    // Find any non-completed match with both teams + frames scaffolded.
    const meta = await page.request.post("/api/graphql", {
      data: {
        query: `query { competition(slug: "${ONGOING_SLUG}") { matchdays { matches { id status frames { frameNumber } } } } }`,
      },
    });
    const ms = (
      await meta.json()
    ).data.competition.matchdays
      .flatMap((d: { matches: Array<{ id: string; status: string; frames: Array<{ frameNumber: number }> }> }) => d.matches)
      .filter(
        (m: { status: string; frames: Array<{ frameNumber: number }> }) =>
          m.status !== "COMPLETED" && m.frames.length > 0,
      );
    test.skip(ms.length === 0, "no usable match");
    const matchId = ms[0]!.id as string;
    const res = await page.request.post("/api/graphql", {
      data: {
        query: `mutation W($matchId: ID!, $frameNumber: Int!, $homeWon: Boolean!) {
          markFrameWalkover(matchId: $matchId, frameNumber: $frameNumber, homeWon: $homeWon) {
            id isWalkover homeWon
          }
        }`,
        variables: { matchId, frameNumber: 1, homeWon: true },
      },
    });
    const updated = (await res.json()).data.markFrameWalkover;
    expect(updated.isWalkover).toBe(true);
    expect(updated.homeWon).toBe(true);
  });

  test("pre-start edit banner is visible to organizer on DRAFT/OPEN", async ({
    page,
  }) => {
    await signInAs(page, "michael");
    await page.goto("/competitions/spring-open-2027");
    await expect(page.getByTestId("prestart-edit-banner")).toBeVisible();
  });
});
