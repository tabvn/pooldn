# PoolDN — Player Scoring, Level & Ranking System (Round 22)

Today a player only has **per-competition** stats (matches, frames won/played, win %, MVP). There is no persistent, cross-competition **player rating / level / global ranking**. Build it. Figma-consistent UI (verify via MCP), CASL, tests.

## Concept
Each player has a persistent **skill rating** and an **XP/level**, updated as match results are approved, with a **global/city leaderboard**.

### A. Rating (skill) — ELO-style
- `User.ratingPoints Int @default(1000)`.
- After each **approved** match result, update both players' (or both teams', then split to participants') ratings using an ELO update: expected = 1/(1+10^((oppRating-rating)/400)); newRating = rating + K*(actual - expected), K ≈ 24. For team matches, update each participating player by the match outcome (or by their frame results for finer granularity).
- Walkover/forfeit: configurable — either no rating change for the no-show penalty, or a small penalty; decide and document.
- Keep a `PlayerRatingHistory { userId, matchId, delta, ratingAfter, createdAt }` so the profile can show a rating trend.

### B. XP & Level — progression
- `User.xp Int @default(0)`, `User.level Int @default(1)`.
- XP sources (on approved results): frame won (+10), match won (+50), MVP (+100), competition placement (winner +500 / runner-up +250), participation (+20 per match played).
- Level derived from XP via thresholds (e.g., level n needs n*1000 XP) OR a tier system: **Bronze / Silver / Gold / Platinum / Diamond / Master** by rating bands. Pick one (recommend numeric level + a tier badge by rating). Show a **level badge** + **progress bar to next level**.

### C. Recompute service
- Extend the result-approval path (where standings + MVP recompute) to also update `ratingPoints`, `xp`, `level`, and append `PlayerRatingHistory`. Wrap in the same transaction. Idempotent re-seed: backfill ratings/xp/levels for seeded players from their seeded match results so the leaderboard has data.

### D. Global / city leaderboard
- New page `/rankings` (or `/leaderboard`): players ranked by rating (default), filterable by **city** and **game type**, with rank #, avatar, name + level badge, rating, win %, matches. Pagination (prismaConnection). Public-readable.
- Optional: separate team leaderboard later.

### E. Profile integration (ties into round-21 player redesign)
- On the player landing page: show **level badge**, **rating** (+ recent trend from history), **global/city rank**, and an XP **progress bar**. Add a "Rating" / "Ranking" element to the Overview tab.
- A reusable `<LevelBadge level tier />` + `<RatingPill rating />` component used on the profile, leaderboard, rosters, and player rows.

## Schema
```prisma
model User {
  // ...
  ratingPoints Int @default(1000)
  xp           Int @default(0)
  level        Int @default(1)
  ratingHistory PlayerRatingHistory[]
}
model PlayerRatingHistory {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  matchId    String?
  delta      Int
  ratingAfter Int
  createdAt  DateTime @default(now())
  @@index([userId, createdAt])
}
```

## Queries / mutations
- `playerRankings(first, after, cityId?, gameType?)` connection.
- Expose `ratingPoints`, `xp`, `level`, `tier`, `rank` (computed) + `ratingHistory` on the player.
- Recompute hooked into match approval (no separate mutation needed); add an admin `recomputeAllRatings` for backfill if useful.

## Tests
- Approve a match → both sides' ratings move by the ELO delta; winner XP/level increase; PlayerRatingHistory row appended.
- Leaderboard ranks players by rating, filters by city/game type, paginates.
- Profile shows level badge + rating + rank + XP progress.
- Seed backfills ratings so the leaderboard + profiles have non-default data.
- Walkover/forfeit applies the documented rating rule.

## Definition of done
Players have a persistent rating + XP + level updated on approved results, a public city/game-filtered leaderboard, and profile integration with reusable level/rating components; seeded data populated; Figma-matched; tests green.
