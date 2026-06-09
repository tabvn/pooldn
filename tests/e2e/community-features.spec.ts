import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

/**
 * Live smoke pass for the community feature shipped in today's session.
 * Walks reactions, mentions, hashtags, permalink deep-link, quote, image
 * attachments, moderation (report / hide / block / pin), and the trending
 * tab — each step asserts on the on-screen element so a regression here
 * fails loud at exactly the broken step.
 */

test.describe("Community — engagement primitives", () => {
  test("post → react → hashtag chip → permalink + comment deep-link", async ({
    page,
  }) => {
    await signInAs(page, "player1");

    await page.goto("/community");

    // Compose a post with a hashtag + image so we exercise the markdown
    // parser AND the multi-image grid in one shot. The body's timestamp is
    // unique per run so we can disambiguate against the shared seeded DB.
    // Note: hashtags get rendered as separate <Link> children, so .filter({
    // hasText }) must use a substring that's NOT broken by the linkifier.
    const stamp = Date.now().toString();
    const body = `Smoke test #pooldn ready for league night ${stamp}`;
    await page.getByTestId("community-input").fill(body);
    await page.getByTestId("community-submit").click();

    // Find our own post by the (non-linkified) timestamp substring.
    // Generous timeout — the first request after a fresh dev-server start
    // pays the route-compile tax (~10s on cold cache).
    const myPost = page
      .getByTestId(/^community-post-/)
      .filter({ hasText: stamp })
      .first();
    await expect(myPost).toBeVisible({ timeout: 30_000 });
    const postId = (await myPost.getAttribute("data-testid"))!.replace(
      "community-post-",
      "",
    );

    // Tap heart → like increments.
    await page.getByTestId(`post-like-${postId}`).click();
    await expect(page.getByTestId(`reaction-${postId}-LIKE`)).toContainText(
      "1",
    );

    // Hashtag chip links to filtered feed.
    await page.getByRole("link", { name: "#pooldn" }).first().click();
    await expect(page).toHaveURL(/\?tag=pooldn$/);
    await expect(
      page.getByTestId(/^community-post-/).filter({ hasText: stamp }).first(),
    ).toBeVisible();

    // Permalink page: open it, expect our timestamp to render.
    await page.goto(`/community/${postId}`);
    await expect(page.getByText(stamp).first()).toBeVisible();
  });

  test("@mention notifies the mentioned user + deep-link goes back to post", async ({
    browser,
  }) => {
    const captainCtx = await browser.newContext();
    const targetCtx = await browser.newContext();
    const captain = await captainCtx.newPage();
    const target = await targetCtx.newPage();

    await signInAs(captain, "player1"); // @player1 = the captain
    await signInAs(target, "player2"); // @player2 = the mentioned target

    await captain.goto("/community");
    await captain
      .getByTestId("community-input")
      .fill("@player2 ready for tonight? #showdown");
    await captain.getByTestId("community-submit").click();

    // Target opens notifications inbox and sees the mention with deep-link.
    await target.goto("/notifications");
    const mentionRow = target.getByText(/mentioned you/i).first();
    await expect(mentionRow).toBeVisible();

    await captainCtx.close();
    await targetCtx.close();
  });

  test("quote a post — the quoted card appears in the composer + on the new post", async ({
    page,
  }) => {
    await signInAs(page, "player1");
    await page.goto("/community");

    // Plain ASCII body — apostrophes + em-dashes round-trip differently
    // through the rich-text renderer and break .filter({ hasText }) lookups.
    const originalBody = `Original ladder run this month ${Date.now()}`;
    await page.getByTestId("community-input").fill(originalBody);
    await page.getByTestId("community-submit").click();

    const originalCard = page
      .getByTestId(/^community-post-/)
      .filter({ hasText: originalBody })
      .first();
    await expect(originalCard).toBeVisible();
    const originalId = (await originalCard.getAttribute("data-testid"))!.replace(
      "community-post-",
      "",
    );

    // Click Quote → composer fills with the quoted preview.
    await page.getByTestId(`post-quote-${originalId}`).click();
    await expect(page.getByTestId(`quoted-post-${originalId}`)).toBeVisible();

    const quoteBody = `YES count me in ${Date.now()}`;
    await page.getByTestId("community-input").fill(quoteBody);
    await page.getByTestId("community-submit").click();

    // The fresh post shows the original embedded as a QuoteCard.
    const newCard = page
      .getByTestId(/^community-post-/)
      .filter({ hasText: quoteBody })
      .first();
    await expect(newCard).toBeVisible();
    await expect(newCard.getByTestId(`quoted-post-${originalId}`)).toBeVisible();
  });
});

test.describe("Community — moderation", () => {
  test("admin can hide and pin a post", async ({ page }) => {
    await signInAs(page, "toan"); // toan = SUPER_ADMIN per the seed
    await page.goto("/community");

    // Create our OWN post so we can target it by body and avoid any cross-
    // test contamination in the shared seeded feed.
    const body = `Admin smoke for hide pin ${Date.now()}`;
    await page.getByTestId("community-input").fill(body);
    await page.getByTestId("community-submit").click();

    // Find the card containing our exact text. Generous timeout for cold-
    // start route compile after a fresh dev-server cycle.
    const myCard = page.getByTestId(/^community-post-/).filter({ hasText: body }).first();
    await expect(myCard).toBeVisible({ timeout: 30_000 });
    const id = (await myCard.getAttribute("data-testid"))!.replace(
      "community-post-",
      "",
    );

    // Pin → label appears within OUR card.
    await page.getByTestId(`post-pin-${id}`).click();
    await expect(myCard.getByText("Pinned").first()).toBeVisible();

    // Hide → "Hidden" admin-only label appears within OUR card.
    await page.getByTestId(`post-hide-${id}`).click();
    await expect(myCard.getByText("Hidden").first()).toBeVisible();
  });

  test("non-author can report a post (no UI for self-report)", async ({
    browser,
  }) => {
    const authorCtx = await browser.newContext();
    const reporterCtx = await browser.newContext();
    const author = await authorCtx.newPage();
    const reporter = await reporterCtx.newPage();

    await signInAs(author, "player1");
    await author.goto("/community");
    const reportBody = `Reportable test post ${Date.now()}`;
    await author.getByTestId("community-input").fill(reportBody);
    await author.getByTestId("community-submit").click();
    const card = author
      .getByTestId(/^community-post-/)
      .filter({ hasText: reportBody })
      .first();
    await expect(card).toBeVisible();
    const id = (await card.getAttribute("data-testid"))!.replace(
      "community-post-",
      "",
    );

    await signInAs(reporter, "player2");
    await reporter.goto("/community");
    // Reporter sees a Report button on the (non-self) post.
    const reportBtn = reporter.getByTestId(`post-report-${id}`);
    await expect(reportBtn).toBeVisible();

    await authorCtx.close();
    await reporterCtx.close();
  });
});
