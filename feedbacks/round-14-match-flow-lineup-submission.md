# PoolDN — Match Flow / Match Details / Lineup Submission (Round 14)

Read live from the Figma "Match Flow _ Captain View" section (node 403-15238; the Match Details/lineup frame is 403-15302/15305). Read the full section frame-by-frame via the Figma MCP for the play/record/scoreboard states.

## CRITICAL DEPENDENCY — this whole flow is generated from the Game Structure
The lineup form is NOT hard-coded. Every row and break in Match Details comes from the competition's **`MatchFormatBlock` structure** (the Structure step / match builder): an ordered list of blocks where each block is Singles / Doubles / Scotch with N games, and breaks sit between blocks. So:
- A Singles block of 3 games → 3 numbered **Singles** rows (each = 1 player slot per side).
- A Doubles block of 2 games → 2 **Doubles** rows (each = 2 player slots per side).
- A break after a block → a **"Break Time for Next Lineup"** separator at that position.
The match's `MatchFrame` rows must be generated from the structure (frameNumber, block type, homePlayer/awayPlayer slots) when the match is created/scheduled. If the structure changes (edit), regenerate unplayed frames.

## The flow (from the Figma)
### 1. Entry
On matchday, a captain selects the **match card** → opens the **Match Details** screen (modal/page) with a lineup selection form. (Design note: "Captains select match card on the day of matchday. It opens match details screen with a lineup selection form.")

### 2. Match Details header
Score card: home team / **score : score** / away team, **status** badge (Scheduled / In progress / Completed), and the **venue** line.

### 3. Match Lineups (submission)
- Helper: "To start the match submit lineups. **Lineups are hidden until both team captains submit their lineups.**"
- The form lists the structure-derived slots in order:
  - **Singles** rows → one player dropdown per side (the captain picks from their roster).
  - **Doubles** rows → two player dropdowns per side.
  - **"Break Time for Next Lineup"** separators between blocks.
- **Submit Lineup** button (per the design, submission is per-block with break separators, or one submit for the full sheet — match the frame; the "Break Time for Next Lineup" buttons imply block-by-block reveal with breaks).
- Rules (from the design notes):
  - **Hidden until both submit**: a captain cannot see the opponent's lineup until both have submitted.
  - **Editable until opponent submits**: "Captains can edit lineups if the opponent hasn't submitted their lineups yet." Once both submit, lineups lock.
- Only the **two captains** of the match may submit (CASL); validate players are on that team's competition roster and not double-assigned within the match.

### 4. Play / record frames
After both lineups are submitted and locked → frames are revealed and played. For each `MatchFrame`: show the two players (from the lineups), **record the winner** (and break&run if that rule is on). The **scoreboard** updates live (running score, race-to progress, block/break indicators).

### 5. Confirm → result → score submission
When all games are played → **confirm**. This feeds the **dual-captain score submission** (round-10): each captain submits the final score; equal → auto-approve; conflict → organizer/admin review. Standings + player stats recompute only on approval.

## Data model
- Use `MatchFrame` (frameNumber, block type, homePlayer, awayPlayer, homeWon) generated from the structure.
- Add lineup-submission state: per side, a `lineupSubmittedAt` / `lineupSubmittedById` (e.g., on `Match` as home/away lineup flags, or a small `MatchLineup` record per side). Gate visibility/locking on both-submitted.
- Wire `MatchParticipant` from the lineups for stats.

## UI/UX
- Match the Match Details frame exactly (modal layout, score card, numbered slot rows, break separators, Submit Lineup, scoreboard) via the Figma MCP.
- States: not-submitted (your form editable), waiting ("waiting for {opponent} to submit"), both-submitted (locked, frames shown), in-progress (record winners), completed (final + per-frame results + MVP). Toasts on submit/record/confirm; confirm dialog on finalize.

## Tests
- Build a competition with a real structure (e.g., 3 Singles + break + 2 Doubles + break + 3 Singles) → generate matches → the Match Details lineup form shows exactly those slots + break separators.
- Captain A submits lineup → opponent's lineup hidden + A can still edit; captain B submits → both lock, frames revealed.
- Record winners → scoreboard updates → confirm → score submission (auto-approve when both captains' scores match; conflict path) → standings recompute.
- Authz: only the two captains submit lineups/scores; only organizer/admin resolves conflicts.

## Definition of done
The lineup form is generated from the game structure, hidden-until-both-submit and editable-until-opponent-submits behave per the design notes, frames play into a live scoreboard, confirm feeds the score-submission workflow, every state matches its Figma frame (verify via MCP), validated + permission-gated + console-clean + Playwright-covered.
