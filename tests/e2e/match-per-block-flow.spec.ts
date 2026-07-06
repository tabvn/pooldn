import { test, expect, type BrowserContext } from "@playwright/test";
import { signInAs, type DemoRole } from "./helpers";

const ONGOING = "da-nang-autumn-invitational-2026";
// Captains that have a demo-login button (helpers.signInAs).
const DEMO = new Set(["toan", "michael", "alex", "thomas", "gen", "hai", "viewer"]);

async function gql(
  ctx: BrowserContext,
  query: string,
  variables?: Record<string, unknown>,
) {
  const res = await ctx.request.post("/api/graphql", {
    data: { query, variables },
  });
  return res.json();
}

const MATCH_STATE = `query($id:ID!){ match(id:$id){
  status currentActiveBlockOrder
  blockStates{ blockOrder published fullyDecided isCurrentActive homeSubmittedAt awaySubmittedAt }
} }`;

const SUBMIT = `mutation($input:SubmitLineupInput!){ submitLineup(input:$input){ id } }`;
const RECORD = `mutation($input:RecordFrameInput!){ recordMatchFrame(input:$input){ id homeWon } }`;

const block1Slots = (roster: string[]) =>
  [1, 2, 3].map((frameNumber, i) => ({ frameNumber, playerId: roster[i] }));

test.describe("Round-60 · per-block sequential match flow", () => {
  test("both captains submit block 1 → publish → winners → block 2 unlocks", async ({
    browser,
  }) => {
    // ── Discovery: find a clean SCHEDULED team match with demo captains ──
    const admin = await browser.newContext();
    const adminPage = await admin.newPage();
    await signInAs(adminPage, "toan");

    const disco = await gql(
      admin,
      `query($slug:String!){ competition(slug:$slug){ matchdays{ matches{
        id status
        homeTeam{ id captain{ username } }
        awayTeam{ id captain{ username } }
      } } } }`,
      { slug: ONGOING },
    );
    const matches = disco.data.competition.matchdays.flatMap(
      (md: { matches: unknown[] }) => md.matches,
    ) as Array<{
      id: string;
      status: string;
      homeTeam?: { id: string; captain?: { username: string } };
      awayTeam?: { id: string; captain?: { username: string } };
    }>;
    const match = matches.find(
      (m) =>
        m.status === "SCHEDULED" &&
        m.homeTeam?.captain &&
        m.awayTeam?.captain &&
        DEMO.has(m.homeTeam.captain.username) &&
        DEMO.has(m.awayTeam.captain.username),
    );
    test.skip(!match, "no clean SCHEDULED team match with demo captains");
    if (!match) return;

    const rosterOf = async (teamId: string) => {
      const r = await gql(
        admin,
        `query($id:ID!){ teamById(id:$id){ members{ user{ id } } } }`,
        { id: teamId },
      );
      return r.data.teamById.members.map(
        (m: { user: { id: string } }) => m.user.id,
      ) as string[];
    };
    const homeRoster = await rosterOf(match.homeTeam!.id);
    const awayRoster = await rosterOf(match.awayTeam!.id);
    expect(homeRoster.length).toBeGreaterThanOrEqual(3);
    expect(awayRoster.length).toBeGreaterThanOrEqual(3);

    // ── Sign in as each captain in its own context ──────────────────────
    const homeCtx = await browser.newContext();
    const homePage = await homeCtx.newPage();
    await signInAs(homePage, match.homeTeam!.captain!.username as DemoRole);

    const awayCtx = await browser.newContext();
    const awayPage = await awayCtx.newPage();
    await signInAs(awayPage, match.awayTeam!.captain!.username as DemoRole);

    // ── 1. Fresh: block 1 active, nothing published ─────────────────────
    let state = (await gql(admin, MATCH_STATE, { id: match.id })).data.match;
    expect(state.currentActiveBlockOrder).toBe(1);
    expect(state.blockStates.find((b: { blockOrder: number }) => b.blockOrder === 1).published).toBe(false);

    // ── 2. Home submits block 1 → still not published (only one side) ───
    let res = await gql(homeCtx, SUBMIT, {
      input: { matchId: match.id, blockOrder: 1, slots: block1Slots(homeRoster) },
    });
    expect(res.errors, JSON.stringify(res.errors)).toBeFalsy();
    state = (await gql(admin, MATCH_STATE, { id: match.id })).data.match;
    const b1AfterHome = state.blockStates.find((b: { blockOrder: number }) => b.blockOrder === 1);
    expect(b1AfterHome.published).toBe(false);
    expect(b1AfterHome.homeSubmittedAt).toBeTruthy();

    // ── 3. Away submits block 1 → published ─────────────────────────────
    res = await gql(awayCtx, SUBMIT, {
      input: { matchId: match.id, blockOrder: 1, slots: block1Slots(awayRoster) },
    });
    expect(res.errors, JSON.stringify(res.errors)).toBeFalsy();
    state = (await gql(admin, MATCH_STATE, { id: match.id })).data.match;
    expect(state.blockStates.find((b: { blockOrder: number }) => b.blockOrder === 1).published).toBe(true);

    // ── 4. Negative: can't submit block 2 before block 1 is decided ─────
    const earlyBlock2 = await gql(homeCtx, SUBMIT, {
      input: {
        matchId: match.id,
        blockOrder: 2,
        slots: [
          { frameNumber: 4, playerId: homeRoster[0], partnerPlayerId: homeRoster[1] },
          { frameNumber: 5, playerId: homeRoster[1], partnerPlayerId: homeRoster[2] },
        ],
      },
    });
    expect(earlyBlock2.errors?.[0]?.message).toMatch(/previous block/i);

    // ── 5. Negative: can't record a block 2 winner (block 2 unpublished) ─
    const earlyWinner = await gql(homeCtx, RECORD, {
      input: { matchId: match.id, frameNumber: 4, homeWon: true },
    });
    expect(earlyWinner.errors?.[0]?.message).toMatch(/isn't published/i);

    // ── 6. UI: a published block-1 card opens the Select Winner modal ───
    await homePage.goto(`/matches/${match.id}`);
    await expect(homePage.getByRole("heading", { name: "Match Details" })).toBeVisible();
    await homePage.getByTestId("lineup-slot-1").click();
    await expect(homePage.getByTestId("winner-modal")).toBeVisible();
    // Block 1 isn't decided yet → Confirm stays disabled until a side is picked.
    await expect(homePage.getByTestId("winner-modal-confirm")).toBeDisabled();

    // ── 7. Record all block-1 winners via API → block 2 becomes active ──
    for (const frameNumber of [1, 2, 3]) {
      const rr = await gql(homeCtx, RECORD, {
        input: { matchId: match.id, frameNumber, homeWon: frameNumber !== 2 },
      });
      expect(rr.errors, JSON.stringify(rr.errors)).toBeFalsy();
    }
    state = (await gql(admin, MATCH_STATE, { id: match.id })).data.match;
    expect(state.status).toBe("IN_PROGRESS");
    expect(state.currentActiveBlockOrder).toBe(2);
    expect(state.blockStates.find((b: { blockOrder: number }) => b.blockOrder === 1).fullyDecided).toBe(true);

    await admin.close();
    await homeCtx.close();
    await awayCtx.close();
  });
});
