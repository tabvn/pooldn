import { expect, test } from "@playwright/test";

/**
 * Round-47 — coverage for the Google OAuth wiring. We can't actually log
 * in via Google in a headless test (no real Google account), so we
 * verify the three things that don't require Google:
 *
 *   1. /api/auth/google/start builds the right authorize URL + sets the
 *      PKCE/state/nonce cookies.
 *   2. /api/auth/google/callback with bad state bounces back to /sign-in
 *      with an authError code.
 *   3. /sign-in renders the "Continue with Google" button and translates
 *      the authError code to friendly copy.
 */

test.describe("google sign-in", () => {
  test("/api/auth/google/start redirects to accounts.google.com with PKCE", async ({
    request,
  }) => {
    const r = await request.get("/api/auth/google/start?next=/teams", {
      maxRedirects: 0,
    });
    // Next.js redirect responses surface as 307 in fetch terms.
    expect(r.status()).toBe(307);
    const loc = r.headers()["location"] ?? "";
    expect(loc.startsWith("https://accounts.google.com/o/oauth2/v2/auth"))
      .toBeTruthy();
    expect(loc).toContain("code_challenge_method=S256");
    expect(loc).toContain("response_type=code");
    expect(loc).toContain("redirect_uri=");
    // Cookies were set so the callback can verify state/nonce/verifier.
    const setCookie = r.headers()["set-cookie"] ?? "";
    expect(setCookie).toContain("g_state=");
    expect(setCookie).toContain("g_nonce=");
    expect(setCookie).toContain("g_verifier=");
    expect(setCookie).toContain("g_next=");
  });

  test("/api/auth/google/callback with bad state → /sign-in?authError=google_state", async ({
    request,
  }) => {
    const r = await request.get(
      "/api/auth/google/callback?code=fake&state=fake",
      { maxRedirects: 0 },
    );
    expect(r.status()).toBe(307);
    expect(r.headers()["location"]).toBe(
      "http://localhost:3000/sign-in?authError=google_state",
    );
  });

  test("/sign-in renders Continue with Google + authError message", async ({
    page,
  }) => {
    await page.goto("/sign-in?authError=google_state");
    await expect(
      page.getByRole("link", { name: /continue with google/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/sign-in session expired/i),
    ).toBeVisible();
  });
});
