import { expect, test } from "@playwright/test";

/**
 * Round-47 — integration coverage for the auth-surface rate limits.
 *
 * Hits /api/graphql directly with Playwright's `request` fixture (no
 * browser). Each test injects a unique x-forwarded-for so the limiter
 * sees it as a fresh IP — keeps tests independent across re-runs and
 * doesn't leak state into the actual dev session's buckets.
 *
 * lib/security/client-ip.ts already reads x-forwarded-for left-most,
 * which is what we exploit here.
 */
const GRAPHQL = "/api/graphql";

const LOGIN_OP = `
  mutation Login($input: LoginInput!) {
    login(input: $input) { token user { id } }
  }
`;
const RESET_REQUEST_OP = `
  mutation RequestPasswordReset($email: String!) {
    requestPasswordReset(email: $email)
  }
`;

function fakeIp() {
  // Random RFC1918 — avoids the 127.0.0.1 bucket the rest of the dev
  // session is using and gives each test a virgin (ip+id) bucket.
  const a = 10;
  const b = (Math.random() * 256) | 0;
  const c = (Math.random() * 256) | 0;
  const d = ((Math.random() * 254) | 0) + 1;
  return `${a}.${b}.${c}.${d}`;
}

async function gql(
  request: import("@playwright/test").APIRequestContext,
  query: string,
  variables: Record<string, unknown>,
  ip: string,
) {
  const r = await request.post(GRAPHQL, {
    data: { query, variables },
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
  });
  return r.json();
}

function pickCode(body: { errors?: Array<{ extensions?: { code?: string } }> }) {
  return body.errors?.[0]?.extensions?.code ?? null;
}

function pickMessage(body: { errors?: Array<{ message?: string }> }) {
  return body.errors?.[0]?.message ?? null;
}

test.describe("rate-limit · auth", () => {
  // The bulk e2e run sets RATE_LIMIT_DISABLED=1 (the suite logs in 100+ times
  // from localhost, which would otherwise trip the limits). These tests verify
  // the limiter actually fires, so they can't run with it disabled — skip
  // them in that mode. Run `RATE_LIMIT_DISABLED= yarn test:e2e rate-limit-auth`
  // to exercise them.
  test.skip(
    process.env.RATE_LIMIT_DISABLED === "1",
    "rate limiting disabled for the bulk e2e run",
  );

  test("login: 11th attempt against the same identifier is RATE_LIMITED", async ({
    request,
  }) => {
    const ip = fakeIp();
    const usernameOrEmail = `rate-${Date.now()}-${Math.floor(
      Math.random() * 1e6,
    )}@e2e.invalid`;
    const password = "wrong-password-attempt";

    for (let i = 0; i < 10; i++) {
      const body = await gql(
        request,
        LOGIN_OP,
        { input: { usernameOrEmail, password } },
        ip,
      );
      // First 10 should be UNAUTHORIZED — limit is 10/window, limiter
      // consumes BEFORE the credential check so each attempt is counted.
      expect(pickCode(body)).toBe("UNAUTHORIZED");
    }

    const body = await gql(
      request,
      LOGIN_OP,
      { input: { usernameOrEmail, password } },
      ip,
    );
    expect(pickCode(body)).toBe("RATE_LIMITED");
    expect(pickMessage(body)).toMatch(/try again/i);
  });

  test("login: a different IP is NOT limited by the per-id rule of another", async ({
    request,
  }) => {
    const usernameOrEmail = `iso-${Date.now()}-${Math.floor(
      Math.random() * 1e6,
    )}@e2e.invalid`;
    const ipA = fakeIp();
    const ipB = fakeIp();

    // Burn 10 against id from ipA.
    for (let i = 0; i < 10; i++) {
      await gql(
        request,
        LOGIN_OP,
        { input: { usernameOrEmail, password: "x" } },
        ipA,
      );
    }
    // ipB hitting the SAME identifier must still have a fresh bucket.
    const body = await gql(
      request,
      LOGIN_OP,
      { input: { usernameOrEmail, password: "x" } },
      ipB,
    );
    expect(pickCode(body)).toBe("UNAUTHORIZED");
  });

  test("requestPasswordReset: 6th attempt is RATE_LIMITED (5/hr per ip+email)", async ({
    request,
  }) => {
    const ip = fakeIp();
    const email = `reset-${Date.now()}-${Math.floor(
      Math.random() * 1e6,
    )}@e2e.invalid`;
    for (let i = 0; i < 5; i++) {
      const body = await gql(request, RESET_REQUEST_OP, { email }, ip);
      // Anti-enumeration returns ok regardless of whether the address exists.
      expect(body.data?.requestPasswordReset).toBe(true);
    }
    const body = await gql(request, RESET_REQUEST_OP, { email }, ip);
    expect(pickCode(body)).toBe("RATE_LIMITED");
  });
});
