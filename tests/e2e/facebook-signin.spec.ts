import { expect, test } from "@playwright/test";

/**
 * Round-47 — coverage for the Facebook OAuth wiring. Same shape as the
 * Google spec: we can't log in via Facebook headlessly, so we exercise the
 * three things that don't need a real FB account.
 *
 *   1. /api/auth/facebook/start builds the right dialog URL + sets state + next.
 *   2. /api/auth/facebook/callback with bad state bounces back to /sign-in
 *      with an authError code.
 *   3. /sign-in renders the "Continue with Facebook" button and translates
 *      the authError code to friendly copy.
 */

test.describe("facebook sign-in", () => {
  test("/api/auth/facebook/start redirects to facebook.com dialog", async ({
    request,
  }) => {
    const r = await request.get("/api/auth/facebook/start?next=/teams", {
      maxRedirects: 0,
    });
    expect(r.status()).toBe(307);
    const loc = r.headers()["location"] ?? "";
    expect(loc.startsWith("https://www.facebook.com/")).toBeTruthy();
    expect(loc).toContain("/dialog/oauth");
    expect(loc).toContain("response_type=code");
    expect(loc).toContain("redirect_uri=");
    expect(loc).toContain("scope=public_profile%2Cemail");
    const setCookie = r.headers()["set-cookie"] ?? "";
    expect(setCookie).toContain("fb_state=");
    expect(setCookie).toContain("fb_next=");
  });

  test("/api/auth/facebook/callback with bad state → /sign-in?authError=facebook_state", async ({
    request,
  }) => {
    const r = await request.get(
      "/api/auth/facebook/callback?code=fake&state=fake",
      { maxRedirects: 0 },
    );
    expect(r.status()).toBe(307);
    expect(r.headers()["location"]).toBe(
      "http://localhost:3000/sign-in?authError=facebook_state",
    );
  });

  test("/sign-in renders Continue with Facebook + authError message", async ({
    page,
  }) => {
    await page.goto("/sign-in?authError=facebook_state");
    await expect(
      page.getByRole("link", { name: /continue with facebook/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/sign-in session expired/i),
    ).toBeVisible();
  });
});
