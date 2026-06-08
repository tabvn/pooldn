import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers";

test.describe("Logout", () => {
  test("clears the session cookie and viewer becomes anonymous", async ({
    page,
    context,
  }) => {
    await signInAs(page, "toan");

    // Cookie exists while signed in.
    const before = await context.cookies();
    const sessionBefore = before.find((c) => c.name === "pooldn_session");
    expect(sessionBefore, "should have session cookie before logout").toBeTruthy();
    expect(sessionBefore?.value).toBeTruthy();

    await page.getByRole("button", { name: /open viewer menu/i }).click(); await page.getByRole("menuitem", { name: /sign out/i }).click();
    await page.waitForURL(/\/sign-in/);

    // Cookie should be gone (Max-Age=0 from the server's clearSessionCookie).
    const after = await context.cookies();
    const sessionAfter = after.find((c) => c.name === "pooldn_session");
    expect(
      !sessionAfter || sessionAfter.value === "",
      "session cookie should be cleared",
    ).toBe(true);

    // Re-visit home — header should show "Sign in", not the previous viewer.
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.getByText("Toan Nguyen")).toHaveCount(0);
  });

  test("logout viewer query returns null after sign-out (API)", async ({
    page,
  }) => {
    await signInAs(page, "michael");
    // Use page.request so cookies are shared with the browser context.
    const beforeRes = await page.request.post("/api/graphql", {
      data: { query: "{ viewer { username } }" },
    });
    const beforeJson = await beforeRes.json();
    expect(beforeJson?.data?.viewer?.username).toBe("michael");

    await page.getByRole("button", { name: /open viewer menu/i }).click(); await page.getByRole("menuitem", { name: /sign out/i }).click();
    await page.waitForURL(/\/sign-in/);

    const afterRes = await page.request.post("/api/graphql", {
      data: { query: "{ viewer { username } }" },
    });
    const afterJson = await afterRes.json();
    expect(afterJson?.data?.viewer).toBeNull();
  });
});
