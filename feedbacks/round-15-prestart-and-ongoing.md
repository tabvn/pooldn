# PoolDN — Competition Pre-Start + Ongoing: complete all screens (Round 15)

From the Figma "Competition Pre-Start" and "Competition Ongoing" sections (read each frame via the Figma MCP). Goal: every tab in both states fully built, wired to real data, Figma-matched, with working actions.

## A. Competition PRE-START (DRAFT → OPEN_FOR_APPLICATIONS / APPLICATIONS_CLOSED, organizer view)
This is the organizer's setup + management view before the competition starts. Tabs: Overview, Matchdays, Players, About, **Applications**.

A.1 **Header**: name, status chip (Draft / Open for applications / Applications closed), format · game chip, icon-chips (dates / city / teams / prize), and the organizer **kebab**: Edit details (full wizard), Publish – open for applications, Close applications, Generate matchdays, Cancel, Delete (draft). (Edit must open the full 5-step wizard prefilled — round-12.)

A.2 **Applications tab** (the core pre-start screen — seen in Figma): 
- **Confirmed Teams** table: Team (logo), Captain / Roster custodian, Home venue, Roster (player count). 
- **Pending / Applied** list with **Approve / Reject / Waitlist** actions per application (notify captain on each). 
- Group by status (Pending / Approved / Waitlisted / Rejected / Cancelled). Roster validation surfaced here too.

A.3 **Matchdays tab** (schedule setup): if empty, a **"Generate matchdays"** CTA (organizer); after generation, the matchday/calendar list with per-matchday edit (date, time, venue) and the fixtures. Generation runs in one transaction from approved teams + format.

A.4 **Players tab**: the pooled players from approved teams' rosters (no stats yet pre-start) — or an empty state until the competition starts.

A.5 **About tab**: description, rules (incl. Break & Run), structure summary (game blocks + breaks), prize distribution, organizer.

A.6 **Overview tab** pre-start: standings table scaffold (empty), the participants summary, and a clear "Not started yet" state (NO winner/MVP banner).

A.7 Make every action work: publish (validates structure/dates/min-teams), approve/reject/waitlist, generate matchdays, edit, with toasts + confirms + empty/loading states.

## B. Competition ONGOING (status = ONGOING, public + organizer)
Tabs: Overview, Matchdays, Players, About (Applications closed/hidden or read-only).

B.1 **Overview**: **League Standings** (live) with team logos, rank highlighting (leader green, relegation red), P/W/D/L/PF/PA/PD/Pts. **No winner/MVP banner while ongoing** (gate to COMPLETED) — instead show the current leader / "In progress". Recent results / next match summary if in the design.

B.2 **Matchdays / Calendar**: matchdays grouped (e.g., "Matchday 1 — Week 1", date), each with its fixtures and status chips (Completed with score / In progress / Scheduled / Postponed). **Clicking a match opens Match Details / scoreboard** (round-14). For the organizer, per-match actions (reschedule, set venue).

B.3 **Players**: live player stats table (Matches, Frames won, Frames played, Win %, MVP tag) from MatchParticipant — updates as results are approved.

B.4 **About**: same as pre-start (description, rules, structure, prize, organizer).

B.5 Organizer kebab on ONGOING: Edit details (allowed now per round-12), Complete, Cancel.

## Data + correctness
- Standings + player stats recompute only when a match result is approved (round-10).
- A rejected/non-approved team never appears in standings (already fixed — keep).
- All money/dates render in locale/timezone (fix the 2 AM bug).

## Tests
- Pre-start: organizer opens applications → approve/reject/waitlist updates + notifies; generate matchdays creates fixtures; edit via wizard persists; publish validates.
- Ongoing: standings reflect approved results; matchday list shows correct statuses; clicking a match opens the scoreboard; players tab shows live stats; no winner banner while ongoing.
- Authz: only the organizer/admin sees setup actions; public sees read-only.

## Definition of done
Every tab in both states renders real data, matches its Figma frame (verify via MCP), every action works with toast/confirm/empty/loading/error states, console-clean, Playwright-covered.
