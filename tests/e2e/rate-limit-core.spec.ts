import { expect, test } from "@playwright/test";

// Force the in-memory backend BEFORE we import the limiter — the module
// captures REDIS_URL at load time. Tests must not depend on a live Redis.
process.env.REDIS_URL = "";

import {
  consume,
  consumeAll,
  describeWait,
} from "../../lib/security/rate-limit";

/**
 * Round-47 — unit-style coverage for the rate-limit core (in-memory).
 * Runs in pure node (no browser, no dev-server). Lives under tests/e2e
 * to share the existing Playwright runner instead of introducing a new
 * unit-test framework just for this file.
 */
test.describe("rate-limit (in-memory)", () => {
  test("allows up to limit, then blocks", async () => {
    const rule = { name: "t-allow", limit: 3, windowMs: 5_000 };
    const id = `id-${Date.now()}-${Math.random()}`;

    const r1 = await consume(rule, id);
    const r2 = await consume(rule, id);
    const r3 = await consume(rule, id);
    const r4 = await consume(rule, id);

    expect(r1.ok).toBe(true);
    expect(r1.remaining).toBe(2);
    expect(r2.ok).toBe(true);
    expect(r2.remaining).toBe(1);
    expect(r3.ok).toBe(true);
    expect(r3.remaining).toBe(0);
    expect(r4.ok).toBe(false);
    expect(r4.remaining).toBe(0);
    expect(r4.resetAt).toBeGreaterThan(Date.now());
  });

  test("consumeAll fails if any single scope trips", async () => {
    const rule = { name: "t-multi", limit: 2, windowMs: 5_000 };
    const tight = `tight-${Date.now()}`;
    const wide = `wide-${Date.now()}`;

    // Pre-burn the "tight" scope so the next consumeAll call must fail
    // on it even though "wide" is fresh.
    await consume(rule, tight);
    await consume(rule, tight);

    const r = await consumeAll(rule, [tight, wide]);
    expect(r.ok).toBe(false);
  });

  test("different identifiers are independent", async () => {
    const rule = { name: "t-iso", limit: 1, windowMs: 5_000 };

    const a = `a-${Date.now()}`;
    const b = `b-${Date.now()}`;

    const ra1 = await consume(rule, a);
    const ra2 = await consume(rule, a);
    const rb1 = await consume(rule, b);

    expect(ra1.ok).toBe(true);
    expect(ra2.ok).toBe(false); // bucket A exhausted
    expect(rb1.ok).toBe(true); // bucket B untouched
  });

  test("window expiry releases the key", async () => {
    const rule = { name: "t-window", limit: 1, windowMs: 120 };
    const id = `exp-${Date.now()}`;

    const r1 = await consume(rule, id);
    expect(r1.ok).toBe(true);
    const r2 = await consume(rule, id);
    expect(r2.ok).toBe(false);

    await new Promise((res) => setTimeout(res, 180));

    const r3 = await consume(rule, id);
    expect(r3.ok).toBe(true);
  });

  test("describeWait returns sensible ETA", () => {
    const short = describeWait(Date.now() + 5_000);
    expect(short.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(short.retryAfterSec).toBeLessThanOrEqual(6);
    expect(short.pretty).toMatch(/seconds$/);

    const long = describeWait(Date.now() + 4 * 60_000);
    expect(long.pretty).toMatch(/minutes?$/);
  });
});
