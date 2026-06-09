/**
 * Round-47 — quick Redis health probe.
 *
 *   npm run redis:check
 *
 * Confirms:
 *   1. REDIS_URL pings.
 *   2. Every key under our prefix has a TTL set (no infinite-lifetime
 *      leaks). Prints a sample so you can eyeball what's flowing through.
 */
import "dotenv/config";
import Redis from "ioredis";

const URL = process.env.REDIS_URL ?? "";
const PREFIX = process.env.RATE_LIMIT_PREFIX ?? "pooldn:rl:";

async function main() {
  if (!URL) {
    console.log("REDIS_URL not set. Limiter runs on the in-memory fallback.");
    process.exit(0);
  }
  const r = new Redis(URL, { maxRetriesPerRequest: 2, enableOfflineQueue: false });
  try {
    const pong = await r.ping();
    console.log(`PING: ${pong}`);

    const keys: string[] = [];
    let cursor = "0";
    do {
      const [next, batch] = await r.scan(cursor, "MATCH", `${PREFIX}*`, "COUNT", "200");
      cursor = next;
      keys.push(...batch);
    } while (cursor !== "0");

    console.log(`Keys under "${PREFIX}": ${keys.length}`);
    if (keys.length === 0) {
      console.log("(none — limiter hasn't fired yet, or Redis was just flushed)");
      return;
    }

    // Spot-check TTLs to confirm nothing is going to leak forever.
    const sample = keys.slice(0, 12);
    let infinite = 0;
    for (const k of sample) {
      const ttl = await r.pttl(k);
      const val = await r.get(k);
      const note = ttl < 0 ? "⚠ NO TTL" : `${Math.ceil(ttl / 1000)}s`;
      if (ttl < 0) infinite++;
      console.log(`  ${k}  count=${val ?? "?"}  ttl=${note}`);
    }
    if (infinite > 0) {
      console.log(
        `\n⚠ ${infinite}/${sample.length} sampled keys had no TTL — bug or pre-script row.`,
      );
      process.exitCode = 2;
    } else {
      console.log("\nAll sampled keys expire. ✓");
    }
  } finally {
    r.disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
