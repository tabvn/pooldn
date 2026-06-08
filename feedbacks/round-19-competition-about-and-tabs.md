# PoolDN — Competition About tab + tabs polish (Round 19)

Re-tested the competition detail tabs live. The **About tab is a thin key-value dump and is missing the important information.** Rebuild it to match the Figma About frame (read via the Figma MCP) and include all of the below.

## What the About tab shows today (too little)
- "Competition" card: Name, Organizer, Type, Format, Game, City, Prize.
- "Structure" card: **mislabeled** — it actually shows MIN/MAX TEAMS, MIN/MAX PLAYERS, RACE TO, STARTS, ENDS (participation + schedule), NOT the match structure.

## What About MUST include
1. **Description** — the competition's full description (currently only a one-liner in the header). Prominent at the top.
2. **Match Structure (the core)** — show the actual ordered **game blocks** from `MatchFormatBlock`: e.g. "Block 1 — 3 Singles → Break 10 min → Block 2 — 2 Doubles → Break → Block 3 — 3 Singles", with total frames / race-to. This is the whole point of the Structure builder and it's absent from About. Include the **Break & Run** rule (`breakAndRunRule`) and any other rules.
3. **Participants** (rename the current "Structure" card to "Participants"): min/max teams, min/max players per team.
4. **Schedule**: scheduling type, start/end dates, matchday count, venues used.
5. **Prize**: total prize pool + **prize distribution breakdown** (1st/2nd/3rd from `prizeDistribution` JSON), currency.
6. **Rules**: points (win/draw/loss), Break & Run, tie-breakers, and a **rules document link** (`rulesUrl`) if set.
7. **Organizer**: name (link to profile) + city.
8. **Venues**: the venues where matches are played (link to venue pages).

## Tabs polish (competition detail "UI very bad")
- Match the Figma competition-detail layout/spacing/typography/tokens for ALL tabs (Overview/Matchdays/Players/About/Applications), not a plain field table. Use the design's card styling, section headers, and chips.
- Consistent empty/loading states per tab.
- About should read like a competition "info page", not a debug dump.

## Tests
- About renders: description, the match-structure blocks (matching the competition's actual blocks), participants, schedule, prize + distribution, rules incl. Break & Run, organizer, venues.
- A competition built with 3 Singles + break + 2 Doubles shows exactly that structure in About.

## Definition of done
About tab matches the Figma frame and surfaces the full competition info (esp. the match structure blocks + rules + prize distribution); all competition tabs match the design styling; console-clean; Playwright-covered.
