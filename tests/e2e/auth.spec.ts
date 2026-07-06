import { test, expect } from "@playwright/test";

test.describe("Sign In", () => {
  test("matches the design (Welcome heading + social buttons + form)", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await expect(
      page.getByRole("heading", { name: "Welcome to PoolDN" }),
    ).toBeVisible();
    await expect(page.getByText("Join the Community")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Continue with Google/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Continue with Facebook/i }),
    ).toBeVisible();
    await expect(page.getByText("OR", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Email or username")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign In", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue as Guest" }),
    ).toBeVisible();
    await expect(page.getByText("Demo accounts")).toBeVisible();
  });

  test("can sign in via the form, see identity, and sign out", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email or username").fill("toan");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();

    await page.waitForURL("/");
    // Header shows "First L." short form; assert exact match to avoid
    // colliding with the dashboard greeting "Welcome back, Toan!".
    await expect(page.getByText("Toan N.")).toBeVisible();

    await page
      .getByRole("button", { name: /open viewer menu/i })
      .click();
    await page.getByRole("menuitem", { name: /sign out/i }).click();
    await page.waitForURL(/\/sign-in/);
    await expect(
      page.getByRole("heading", { name: "Welcome to PoolDN" }),
    ).toBeVisible();
  });

  test("demo-account quick login signs in as the chosen role", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await page.getByTestId("demo-login-michael").click();
    await page.waitForURL("/");
    await expect(page.getByText("Michael D.")).toBeVisible();
  });

  test("invalid credentials surface an error", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email or username").fill("toan");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();

    await expect(
      page.locator("form").getByRole("alert"),
    ).toContainText(/Invalid credentials/i);
  });

  test("Sign In honors ?next= redirect", async ({ page }) => {
    await page.goto("/sign-in?next=/notifications");
    await page.getByTestId("demo-login-toan").click();
    await page.waitForURL(/\/notifications/);
    await expect(
      page.getByRole("heading", { name: "Notifications" }),
    ).toBeVisible();
  });
});

test.describe("Sign Up", () => {
  test("matches the design (Welcome + Given/Family/Email/Password/Re-Enter)", async ({
    page,
  }) => {
    await page.goto("/sign-up");
    await expect(
      page.getByRole("heading", { name: "Welcome to PoolDN" }),
    ).toBeVisible();
    await expect(page.getByLabel("Given Name (First)")).toBeVisible();
    await expect(page.getByLabel("Family Name (Last)")).toBeVisible();
    await expect(page.getByLabel("Email Address")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Re-Enter Password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Join", exact: true }),
    ).toBeVisible();
  });

  test("validates passwords match", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByLabel("Given Name (First)").fill("Test");
    await page.getByLabel("Family Name (Last)").fill("User");
    await page.getByLabel("Email Address").fill("e2e-mismatch@pooldn.local");
    await page.getByLabel("Password", { exact: true }).fill("password123");
    await page.getByLabel("Re-Enter Password").fill("password456");
    await page.getByRole("button", { name: "Join", exact: true }).click();
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });

  test("validates required fields", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByRole("button", { name: "Join", exact: true }).click();
    // 3 required-field errors at minimum
    await expect(page.getByText("Required").first()).toBeVisible();
  });
});
