# PoolDN — Competition detail + Dashboard UI review & improvement plan (Round 40)

Reviewed (as player Linh):
- `/competitions/da-nang-international-pool-league-2026` (a COMPLETED league)
- `/` (dashboard)

Comparison is against the PoolDN Figma design language (cover-image hero, iconned stat pills, tabbed sections, rich completed-state recap). Both pages are functional and on-brand but visually flatter and thinner-on-data than the design.

---
## A. Competition detail page

### What's good (keep)
- Tabs Overview / Matchdays / Players / About work; Follow button present; 0 broken images.
- Completed state shows a **Champion ("Gen Filling Station — Winner!")** + **MVP ("Gen Hoang")** banner.
- Standings table has the full column set (P W D L PF PA PD PTS) with a legend; Matchday card shows the result (Gen Filling Station vs Da Nang Tigers 5–3, COMPLETED).

### Fix (priority order)
1. **No hero COVER IMAGE (P1).** The hero is a text-only colored band. `bannerUrl` exists in the data but is never rendered. Figma uses a large cover hero: banner image + dark gradient overlay, status pill, title, one-line description, and the Follow/primary action on top. Add it.
2. **Thin/unrealistic data — apply the round-31 seed to THIS competition (P1).** Header says "4–5 teams" but standings list only **2** teams and there is only **1 matchday / 1 match** for a COMPLETED league. A completed round-robin of 4–5 teams should have every team in the standings, multiple matchdays, full results, and the champion derived from real points. Seed full round-robin results (all-play-all), multiple matchdays, MVP, and final standings.
3. **Stat meta = plain text chips (P2).** Dates, location, "4–5 teams", "5,000,000 VND" are unstyled text. Replace with **iconned stat pills** (calendar, map-pin, users, trophy/prize, game-type) grouped in a stat row — matches Figma and improves scannability.
4. **Standings polish (P2).** Highlight the champion row (gold/accent), zebra striping, sticky header, right-align numbers, and show movement/rank chips. List ALL participating teams, not just those with a played match.
5. **Richer completed-state recap (P2).** Beyond champion+MVP, add a results summary: top scorers / break-and-run leaders, total matchdays played, prize distribution (1st/2nd/3rd), and a final bracket/results recap or "season highlights". Figma's completed frame is denser.
6. **Overview should surface more before standings (P3).** A short schedule preview (next/last matchdays), registered-teams grid with logos, and venue(s) — currently it jumps straight to standings.

---
## B. Dashboard (`/`)

### What's good (keep)
- Hero "Welcome back, Linh! · Ready to compete?" + Browse all; clean Upcoming / Active / Following sections; Following correctly mixes a competition + 3 teams (4 items); team avatars render; empty-state line for no scheduled matches.

### Fix (priority order)
1. **Competition cards have NO cover image (P1).** Confirmed: the Upcoming/Active/Following competition cards render no `<img>` and no background image — only team cards show avatars. This is the round-30 bug still visible in the UI: the query returns `bannerUrl` but the card component doesn't render it. Add the cover to the shared competition card so it shows everywhere (dashboard, browse, following).
2. **Build ONE shared `CompetitionCard` (P1).** Use it on the dashboard, competitions browse, and detail "related" — cover image + status pill + title + iconned meta (game type, dates, city, prize). Removes the current text-only inconsistency and fixes the missing-cover bug in one place.
3. **Iconned stat pills (P2).** Same as the detail page — replace plain text meta with iconned pills for consistency.
4. **Personalize the hero more (P2).** Next-match countdown / "you're up next" when the player has a scheduled match; your current rank/level (from the rankings feature); quick actions (Find a team, Apply to a competition) in the empty state.
5. **Section density (P3).** Each section currently shows 1 item due to thin seed — verify the round-31 seed populates several upcoming/active/following so the dashboard looks alive; add a subtle "View all" affordance (already present) and skeleton loading states.

---
## Cross-cutting
- **Render `bannerUrl` everywhere** (hero + every competition card). This single fix resolves the most visible gap vs Figma on both pages.
- **Apply the round-31 comprehensive seed** so completed/ongoing competitions have realistic teams, matchdays, results, MVP, and standings.
- **Shared components**: `CompetitionCard`, `StatPill`, `CompetitionHero` — unify so browse/dashboard/detail stay consistent.

## Definition of done
Competition detail has a cover-image hero, iconned stat pills, highlighted full standings, and a rich completed recap; the dashboard uses one shared CompetitionCard with cover images and iconned meta; both are backed by the round-31 full seed; Figma-matched; tests green.
