import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;

// The suite logs in 100+ times from localhost; without this it trips the
// login/IP rate limits partway through and every later sign-in times out.
// Set on the runner process so both the web server (inherited via env below)
// and the rate-limit-auth spec (which skips itself when this is on) agree.
process.env.RATE_LIMIT_DISABLED = process.env.RATE_LIMIT_DISABLED ?? "1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    video: "off",
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Run e2e against a PRODUCTION build, not `next dev`. The dev server
  // (Turbopack) compiles each route on first hit, so cold navigations blew
  // past the expect/test timeouts and made the suite flaky + ~1h long. A
  // prebuilt `next start` serves every route instantly and deterministically.
  // Locally, if a prod server is already up on :3000 it's reused (skip the
  // build); CI always builds fresh. The build is folded into the command so
  // the served bundle always matches the working tree.
  webServer: {
    command: "npm run build && npm run start:e2e",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: "ignore",
    stderr: "pipe",
    // The web server inherits the runner's env, which carries the
    // RATE_LIMIT_DISABLED set above so the prod server skips rate limits.
  },
});
