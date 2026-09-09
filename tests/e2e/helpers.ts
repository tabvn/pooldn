import type { Page } from "@playwright/test";

export type DemoRole =
  | "toan"
  | "michael"
  | "alex"
  | "thomas"
  | "gen"
  | "hai"
  // Round-69 — extra demo captains (each captains a team).
  | "long"
  | "duc"
  | "kenji"
  | "sofia"
  | "raj"
  | "player1"
  | "player2"
  | "viewer";

/** Every seeded account uses this password (prisma/seed.ts). */
export const SEED_PASSWORD = "password123";

/**
 * Round-89 — the quick-login demo panel was removed from the sign-in screen
 * before launch, so tests sign in the way a real user does: the form takes a
 * username or an email.
 */
export async function signInAs(
  page: Page,
  username: DemoRole,
  opts: { next?: string } = {},
) {
  await page.goto(opts.next ? `/sign-in?next=${opts.next}` : "/sign-in");
  await page.getByLabel("Email or username").fill(username);
  await page.getByLabel("Password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.waitForURL(opts.next ? new RegExp(opts.next) : "/");
}

export async function signOut(page: Page) {
  // Sign Out now lives inside the viewer-menu dropdown; open it first.
  await page.getByRole("button", { name: /open viewer menu/i }).click();
  await page.getByRole("menuitem", { name: /sign out/i }).click();
  await page.waitForURL(/\/sign-in/);
}
