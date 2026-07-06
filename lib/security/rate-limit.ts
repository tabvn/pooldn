/**
 * Round-47 — small rate-limit primitive.
 *
 * Two backends behind one interface so the same call-sites work in dev
 * (in-memory map) and prod (Redis). Selection is automatic — if REDIS_URL
 * is set we use ioredis; otherwise we fall back to an LRU-trimmed Map.
 *
 * NOTE: this Redis DB is shared across multiple projects. Every key is
 * prefixed with `RATE_LIMIT_PREFIX` (default "pooldn:rl:") so PoolDN
 * never collides with sibling apps. Override the prefix per-environment
 * if you run multiple PoolDN tenants on the same Redis instance.
 *
 * Algorithm: fixed-window counter with TTL. Simpler than a leaky bucket
 * and matches typical "N per Ns" UX copy 1:1. If we ever need burst
 * smoothing (e.g. login: 10/min steady but 30/min burst), bump to a
 * sliding-window in Redis with a single Lua script.
 */
import Redis from "ioredis";

const PREFIX = process.env.RATE_LIMIT_PREFIX ?? "pooldn:rl:";
const REDIS_URL = process.env.REDIS_URL ?? "";

// Explicit opt-out for automated test environments. The e2e suite logs in
// 100+ times from a single IP (localhost), which legitimately trips the
// login/IP limits and turns every later sign-in into a 60s timeout. Set
// RATE_LIMIT_DISABLED=1 ONLY for e2e (playwright webServer env) — production
// never sets it, so real limits stay intact.
const DISABLED = process.env.RATE_LIMIT_DISABLED === "1";

let redis: Redis | null = null;
function getRedis(): Redis | null {
  if (!REDIS_URL) return null;
  if (redis) return redis;
  try {
    redis = new Redis(REDIS_URL, {
      // Don't crash the app boot on a bad URL — degrade to in-memory.
      lazyConnect: false,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
    });
    redis.on("error", (e) => {
      console.warn("[rate-limit] redis error, falling back to memory:", e.message);
    });
    return redis;
  } catch (e) {
    console.warn("[rate-limit] redis init failed:", e);
    return null;
  }
}

// ── In-memory fallback ──────────────────────────────────────────────────
// Map<key, { count, resetAt }>. Trim opportunistically to bound size.
const mem = new Map<string, { count: number; resetAt: number }>();
const MEM_MAX = 5_000;

function memHit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const cur = mem.get(key);
  if (!cur || cur.resetAt <= now) {
    mem.set(key, { count: 1, resetAt: now + windowMs });
    if (mem.size > MEM_MAX) {
      // Cheap eviction: drop the oldest 10% by resetAt.
      const arr = Array.from(mem.entries()).sort(
        (a, b) => a[1].resetAt - b[1].resetAt,
      );
      for (let i = 0; i < Math.floor(arr.length * 0.1); i++) {
        mem.delete(arr[i]![0]);
      }
    }
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  cur.count += 1;
  if (cur.count > limit) {
    return { ok: false, remaining: 0, resetAt: cur.resetAt };
  }
  return { ok: true, remaining: limit - cur.count, resetAt: cur.resetAt };
}

/**
 * Atomic INCR + first-hit EXPIRE in a single Redis round-trip.
 *
 * Why a Lua script:
 *   - A pipelined INCR + PEXPIRE is NOT atomic. Under load the EXPIRE can
 *     race the second INCR from a different client and leave a key with
 *     no TTL — that would leak rows forever.
 *   - With EVAL the whole thing executes inside a single Redis call, so
 *     every key that is ever INCR'd here is guaranteed to also have a
 *     TTL set. Worst case: the script fails → caller falls back to memory.
 *
 * Returns [count, pttlMs].
 */
const HIT_SCRIPT = `
  local v = redis.call('INCR', KEYS[1])
  if v == 1 then
    redis.call('PEXPIRE', KEYS[1], ARGV[1])
    return { v, tonumber(ARGV[1]) }
  end
  local ttl = redis.call('PTTL', KEYS[1])
  -- Defensive: if a row exists with no TTL for any reason, re-arm it.
  if ttl < 0 then
    redis.call('PEXPIRE', KEYS[1], ARGV[1])
    return { v, tonumber(ARGV[1]) }
  end
  return { v, ttl }
`;

async function redisHit(
  client: Redis,
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const fullKey = PREFIX + key;
  try {
    const raw = (await client.eval(
      HIT_SCRIPT,
      1,
      fullKey,
      String(windowMs),
    )) as [number, number];
    const [count, ttl] = raw;
    if (count > limit) {
      return {
        ok: false,
        remaining: 0,
        resetAt: Date.now() + Math.max(0, ttl),
      };
    }
    return {
      ok: true,
      remaining: Math.max(0, limit - count),
      resetAt: Date.now() + Math.max(0, ttl),
    };
  } catch (e) {
    // Transport hiccup — degrade open. Caller logs the warning.
    throw e;
  }
}

// ── Public API ──────────────────────────────────────────────────────────

export type RateLimitResult = {
  /** True = caller is under the limit and may proceed. */
  ok: boolean;
  /** Remaining hits in the current window. */
  remaining: number;
  /** Epoch-ms when the window resets. */
  resetAt: number;
};

export type RateLimitRule = {
  /** Stable identifier used in the key (e.g. "login", "request-reset"). */
  name: string;
  /** Hits permitted per window. */
  limit: number;
  /** Window length in ms. */
  windowMs: number;
};

/**
 * Consume one slot against `rule` for the identity `id`. Returns the
 * decision; never throws on transport failure (degrades to allow).
 */
export async function consume(
  rule: RateLimitRule,
  id: string,
): Promise<RateLimitResult> {
  if (DISABLED) {
    return { ok: true, remaining: rule.limit, resetAt: Date.now() + rule.windowMs };
  }
  const key = `${rule.name}:${id}`;
  const r = getRedis();
  if (r) {
    try {
      return await redisHit(r, key, rule.limit, rule.windowMs);
    } catch (e) {
      console.warn("[rate-limit] redis hit failed, memory fallback:", e);
    }
  }
  return memHit(key, rule.limit, rule.windowMs);
}

/**
 * Compose multiple consumes (different scopes — by IP, by email, by user)
 * and FAIL if any single one says no. We always return the SOONEST reset
 * time so the user can retry from the right clock.
 */
export async function consumeAll(
  rule: RateLimitRule,
  ids: ReadonlyArray<string>,
): Promise<RateLimitResult> {
  const results = await Promise.all(ids.map((id) => consume(rule, id)));
  const failed = results.find((r) => !r.ok);
  if (failed) return failed;
  // All passed — return the row with the smallest `remaining` (the most
  // strained scope) so the headers reflect the tightest limit.
  return results.reduce((best, r) =>
    r.remaining < best.remaining ? r : best,
  );
}

/** Convenience for resolver throws — pretty message + Retry-After hint. */
export function describeWait(resetAt: number): {
  retryAfterSec: number;
  pretty: string;
} {
  const sec = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  if (sec >= 60) {
    const m = Math.ceil(sec / 60);
    return { retryAfterSec: sec, pretty: `${m} minute${m === 1 ? "" : "s"}` };
  }
  return { retryAfterSec: sec, pretty: `${sec} seconds` };
}
