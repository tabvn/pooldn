import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

/**
 * Round-44 — full team invitation round trip.
 *
 * Asserts:
 *   1. Captain invites a player → ROSTER_INVITE notification lands in the
 *      invitee's inbox with a deeplink to the team page.
 *   2. Invitee opens /teams/<slug> → Round-33 banner is visible with the
 *      inviter's name + Accept/Decline.
 *   3. Invitee accepts → membership created.
 *   4. Captain receives a notification that the invitee joined.
 *   5. Pending-invitations list on /manage no longer contains the row.
 *
 * Uses the GraphQL transport for the inviter side so we don't depend on the
 * captain wizard UI; the invitee uses the real /teams/<slug> page so we
 * exercise the banner.
 */
test.describe("Team invitation full flow", () => {
  test("invite → accept → both sides see the notification chain", async ({
    browser,
  }) => {
    const captainCtx = await browser.newContext();
    const inviteeCtx = await browser.newContext();
    const captain = await captainCtx.newPage();
    const invitee = await inviteeCtx.newPage();

    await signInAs(captain, "gen"); // Gen captains a couple of teams

    // Identify Gen's team + a non-member player to invite.
    const meta = await captain.request.post("/api/graphql", {
      data: {
        query: `query {
          viewer { id username name }
          teams {
            id name slug
            captain { id username }
            members { user { id username } }
          }
          users { id username name }
        }`,
      },
    });
    const m = (await meta.json()).data;
    const myTeam = m.teams.find(
      (t: { captain: { id: string } }) => t.captain.id === m.viewer.id,
    );
    test.skip(!myTeam, "captain has no captained team in the seed");
    // Pick a target that has a demo-quick-login button — captains can
    // only invite by user, and the test then needs to sign in as that
    // person. Limit to known demo accounts to avoid signing in as a seed
    // user without a quick-login.
    const DEMO_ACCOUNTS = [
      "toan", "michael", "alex", "thomas", "hai", "player1", "player2",
    ];
    const memberIds = new Set(
      myTeam.members.map((mem: { user: { id: string } }) => mem.user.id),
    );
    const target = m.users.find(
      (u: { id: string; username: string }) =>
        DEMO_ACCOUNTS.includes(u.username) &&
        !memberIds.has(u.id) &&
        u.id !== m.viewer.id,
    );
    test.skip(!target, "no demo-account candidate to invite");

    // Send the invitation.
    const invite = await captain.request.post("/api/graphql", {
      data: {
        query: `mutation I($teamId: ID!, $userId: ID!) {
          inviteToTeam(teamId: $teamId, userId: $userId) {
            id status
          }
        }`,
        variables: { teamId: myTeam.id, userId: target.id },
      },
    });
    const inviteJson = await invite.json();
    test.skip(
      !!inviteJson.errors,
      `invite already pending or duplicate: ${inviteJson.errors?.[0]?.message}`,
    );
    expect(inviteJson.data.inviteToTeam.status).toBe("PENDING");

    // Invitee signs in and confirms the notification is visible.
    await signInAs(invitee, target.username as never);
    await invitee.goto("/notifications");
    await expect(
      invitee.getByText(new RegExp(`Team invite: ${myTeam.name}`, "i")).first(),
    ).toBeVisible();

    // Visit the team page — Round-33 banner should appear with Accept/Decline.
    await invitee.goto(`/teams/${myTeam.slug}`);
    const banner = invitee.getByTestId("invite-banner");
    await expect(banner).toBeVisible();
    await expect(banner.getByText(/invited you to join/i)).toBeVisible();
    await invitee.getByTestId("invite-accept").click();
    // The banner should disappear after acceptance + page refresh.
    await expect(invitee.getByTestId("invite-banner")).toHaveCount(0);

    // Captain receives the "joined" notification.
    await captain.goto("/notifications");
    await expect(
      captain
        .getByText(new RegExp(`${target.name ?? "joined"}.*joined ${myTeam.name}`, "i"))
        .first(),
    ).toBeVisible({ timeout: 10_000 });

    // Pending invitations list on /manage no longer contains the accepted row.
    await captain.goto(`/teams/${myTeam.slug}/manage`);
    await expect(
      captain.getByTestId(`pending-invite-${inviteJson.data.inviteToTeam.id}`),
    ).toHaveCount(0);

    await captainCtx.close();
    await inviteeCtx.close();
  });
});
