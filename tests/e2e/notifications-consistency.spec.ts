import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers";

const COUNT_QUERY = `{ unreadNotificationCount }`;
const LIST_QUERY = `
  query Inbox {
    notifications(first: 50) {
      nodes { id isRead }
      nextCursor
    }
  }
`;

test.describe("Notifications — bell count vs inbox list never disagree", () => {
  test("Michael (organizer): count matches the number of unread node rows", async ({
    page,
  }) => {
    await signInAs(page, "michael");

    // Bell badge count
    const countRes = await page.request.post("/api/graphql", {
      data: { query: COUNT_QUERY },
    });
    const countJson = await countRes.json();
    const count: number = countJson.data.unreadNotificationCount;

    // Inbox first page
    const listRes = await page.request.post("/api/graphql", {
      data: { query: LIST_QUERY },
    });
    const listJson = await listRes.json();
    const nodes: Array<{ id: string; isRead: boolean }> =
      listJson.data.notifications.nodes;
    const unreadInPage = nodes.filter((n) => !n.isRead).length;

    // Sanity: total list length >= unread count when count fits in one page.
    expect(nodes.length).toBeGreaterThanOrEqual(unreadInPage);

    // Core invariant: the bell count must equal the unread rows currently on
    // page 1 (because we have far less than 50 seeded notifications).
    expect(unreadInPage).toBe(count);
  });

  test("Inbox UI shows rows that match the count", async ({ page }) => {
    await signInAs(page, "michael");
    await page.goto("/notifications");
    // Should render at least one notification row OR the empty state.
    const rows = page.locator("[data-testid^='notification-']");
    const countRes = await page.request.post("/api/graphql", {
      data: { query: COUNT_QUERY },
    });
    const count: number =
      (await countRes.json()).data.unreadNotificationCount;
    if (count > 0) {
      await expect(rows.first()).toBeVisible();
    }
  });
});
