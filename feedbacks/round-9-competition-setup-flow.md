# PoolDN — Competition Setup Flow (Participants / Schedule / Structure / Review & Publish)

This is the most important organizer flow and it is under-built. The Figma has it as both a **creation wizard** ("Create Competition / Step 1…") and an editable **"Competition Pre-Start"** management view (tabs: Applications/Participants, Matchdays/Schedule, Structure, About — editable while DRAFT, with Publish). Use the Figma MCP to read the Competition Pre-Start + Competition Creation Flow sections frame-by-frame; the spec below is the structure.

Critical schema gap: there is **no match-structure model** — only flat `raceToFrames` + `framesPerMatchday`. The "Structure / match builder" (game blocks + break time) must be modeled and wired into match generation and the Match Flow lineup screen.

## The flow (wizard = create; same steps editable in Pre-Start tabs = manage)

### Step 1 — Basics
name, description, banner image (upload), game type, format (round robin / single & double elim / swiss), type (TEAMS / INDIVIDUAL), city. Slug auto from name.

### Step 2 — Participants settings
min/max teams, min/max players per team, application deadline, roster requirements, who may apply. In Pre-Start this becomes the **Applications/Participants tab**: Confirmed Teams table (team, captain, home venue, roster) + Pending/Applied table with Approve/Reject/Waitlist.

### Step 3 — Schedule
scheduling type (FIXED_DATE / FLEXIBLE / AUTO_GENERATED), start/end dates, venues, and matchday setup (number, label, date, start/end time). In Pre-Start = **Matchdays/Schedule tab** with "Generate matchdays" and per-matchday editing.

### Step 4 — Structure (MATCH BUILDER) — the key new feature
The organizer defines the **match format** as an ordered list of **game blocks**, with break time between blocks:
- Each block: `gameType` (SINGLES | DOUBLES | SCOTCH_DOUBLES), number of games/frames in the block, optional race-to, and an optional **break after** the block with a duration (minutes) — the "Break Time for Next Lineup" seen in the Match Flow.
- Example: Block 1 = 5 Singles → Break 10m → Block 2 = 2 Doubles → Block 3 = 3 Singles.
- Add/remove/reorder blocks (drag handle), live total-frames + "race to win" computation.
- Scoring: points win/draw/loss, tie-break rules.
- **Rules**: include the **Break & Run** toggle (designer note: "Break & Run = a player wins without letting the opponent take a shot") and any other special-frame rules.

Schema to add:
```prisma
enum GameBlockType { SINGLES DOUBLES SCOTCH_DOUBLES }
model MatchFormatBlock {
  id            String        @id @default(cuid())
  competitionId String
  competition   Competition   @relation(fields: [competitionId], references: [id], onDelete: Cascade)
  order         Int
  type          GameBlockType
  games         Int           @default(1)
  raceTo        Int?
  breakAfterMin Int?          // break time after this block
  @@unique([competitionId, order])
}
```
Add a `rules Json?` (or explicit columns) on Competition for Break & Run etc. Wire it so: match generation builds frames from the blocks; the **Match Flow lineup screen** renders Singles/Doubles slots from the blocks and shows break time between blocks; "lineups hidden until both captains submit" still applies per block.

### Step 5 — Review & Publish
A read-only summary of every step (Basics, Participants, Schedule, Structure/blocks, Rules), client+server validation (e.g., blocks defined, dates valid, min teams ≥ 2), then **Publish** (DRAFT → OPEN_FOR_APPLICATIONS) or **Save Draft**. Publish requires confirm; show what becomes locked after publish.

## Mutations / API
- Extend `createCompetition` + add `updateCompetition` to accept the full config incl. an ordered `blocks[]` (upsert/replace MatchFormatBlock rows in a transaction).
- `publishCompetition` already exists — make it validate the full structure before flipping status.
- Restrict which fields are editable after OPEN/ONGOING (basics/structure locked; schedule/venue may stay editable).

## UI/UX (Figma-exact via MCP)
- Wizard: lime "Step N" header band, progress indicator, Back/Next, the per-step layouts from the Creation Flow frames.
- Structure builder: block cards with type, games, race-to, break-after; drag to reorder; add-block button; running totals.
- Pre-Start management: the same config surfaced in the competition detail tabs while DRAFT, each with an Edit affordance and the Publish CTA.
- Validation inline (zod+RHF), toasts on save/publish, confirm on publish, empty/loading/error states.

## Tests
Organizer: create → fill all 5 steps (incl. ≥2 game blocks with a break) → review → publish → status OPEN; structure persists; generated matches reflect the blocks; Match Flow lineup renders Singles/Doubles slots from the blocks with break time. Permission: only organizer/admin can edit/publish; fields locked after publish behave correctly.

## Note on "follow"
Separately, the Follow feature (round-8) must be implemented carefully: follow a competition/team → it appears in the dashboard "Following" section → notifications on followed-entity events (competition starts, followed team's match scheduled) via NotificationService, with optimistic toggle and a per-user `@@unique` guard.
