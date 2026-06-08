import type { Page } from "@playwright/test";

export type DemoRole =
  | "toan"
  | "michael"
  | "alex"
  | "thomas"
  | "gen"
  | "hai"
  | "player1"
  | "player2"
  | "viewer";

export async function signInAs(page: Page, username: DemoRole) {
  await page.goto("/sign-in");
  await page.getByTestId(`demo-login-${username}`).click();
  await page.waitForURL("/");
}

export async function signOut(page: Page) {
  // Sign Out now lives inside the viewer-menu dropdown; open it first.
  await page.getByRole("button", { name: /open viewer menu/i }).click();
  await page.getByRole("menuitem", { name: /sign out/i }).click();
  await page.waitForURL(/\/sign-in/);
}
