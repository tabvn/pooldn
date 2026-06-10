# PoolDN — Competition creation wizard: stepper + can't-reach-Review bugs (Round 48)

File: `app/(shell)/competitions/new/form.tsx` (also used for edit). Steps defined:
Basics(0) · Participants(1) · Schedule(2) · Structure(3) · **Season preview(4)** · **Review & Publish(5)**.

**Live test result (organizer michael):** with valid inputs the wizard DOES reach Step 6/6 "Review & Publish" (Confirm & Publish button present) — so Review & Publish is reachable, NOT a hard block. The real problems are the stepper clarity (Bug 1) and the silent validation failure that can strand users earlier (Bug 2). Fix those, not a non-existent block.

## Bug 1 — the stepper doesn't show the CURRENT step (P1)
The progress indicator (lines ~478–498) is a row of thin, **unlabeled** dots. The color logic makes **completed and current steps identical**:
```
i < step  → "bg-black"      // completed
i === step → "bg-black"     // current (SAME as completed!)
i > step  → "bg-black/20"   // future
```
So the user can't tell which step they're on, and there are no step names. Figma shows labeled steps with the active one highlighted.
**Fix:** render labeled steps (Basics · Participants · Schedule · Structure · Review & Publish) with a **distinct active state** (accent color/ring for `i === step`, filled check for completed, muted for future), matching Figma. Keep past steps clickable; show the step title under each marker on desktop.

## Bug 2 — "Review & Publish can't be reached": Next fails silently (P1)
`nextStep()` (line ~338) runs `trigger(FIELDS_BY_STEP[step])` and on failure just `return`s — **no toast, no visible error**. On the **Structure** step the validated field is `structureItems` (requires ≥1 game block); that's an array, not a focusable input, so `shouldFocus` does nothing visible. Result: the user clicks **Next**, nothing happens, and they are stuck at Structure and never see Season preview or Review & Publish.
**Fix:** when `nextStep` validation fails, surface it — a toast ("Add at least one game block to continue") and/or an inline error banner on the step, and scroll to the offending control. Make the Structure step's empty/invalid state obvious. Verify every step's validation can actually be satisfied through the UI.

## Bug 3 — extra "Season preview" step vs Figma (P2)
The flow inserts a 6th step ("Season preview") between Structure and Review & Publish. The intended flow is Basics → Participants → Schedule → Structure → **Review & Publish**. Decide: either drop "Season preview" (fold the generated-calendar preview into Review & Publish), or confirm it's intended and add it to the Figma/step labels so it's not a surprise. Either way the step labels must match what's shown.

## Also verify against Figma (per-step content)
- **Schedule** (step 2): city, scheduling type, end date, matchday count, start/end time, max games per venue/matchday — present; confirm layout + labels match Figma.
- **Structure** (step 3): match builder (Singles/Doubles/Scotch game blocks + games + raceTo + break time) and Break & Run rule — confirm the builder UX matches Figma's "match builder + break time + game block".
- **Review & Publish** (step 5): review groups with Edit links per section, and the final CTA "Confirm & Publish" (saves as DRAFT). Confirm wording/visibility.

## Bug 4 — Participants step is missing "How participants apply" + summary (P1)
Current Participants step only has Min/Max teams, Min/Max players per team, Race to frames. Per Figma it must also include:
- **How participants apply** — application mode setting (e.g. "Any team can apply" / open vs invite-only vs approval-required). Add the field (schema + GraphQL + UI) and use it to gate the Apply flow.
- **Per-step confirmation summary** — a plain-language recap at the bottom of the step, e.g. *"Any team can apply. Max 24 participants. Team roster size 3 to 10 players."* Every step should end with this kind of human-readable confirmation sentence built from the entered values (Figma shows this on each step).

## Bug 5 — Schedule step missing fields vs Figma (P1)
Current Schedule step has Scheduling type, City, Matchdays count, End date, start/end time, Max games per venue per matchday. Figma's Schedule step is labeled **Scheduling Type · Games per Opponent · Where Matches Are Played**:
- ❌ **Games per Opponent** — how many times each team plays each opponent (single/double round-robin, or N). Add it and feed it into matchday generation.
- ⚠️ **Where Matches Are Played** — currently only an optional City dropdown. Needs real **venue selection** (which venue(s) host matches), not just a city. Align label + control with Figma.
- Match the Figma labels/grouping for the Schedule step.

## Per-step confirmation summaries (all steps)
Add the Figma-style confirmation recap to the bottom of EVERY step (Basics, Participants, Schedule, Structure), summarizing the chosen values in plain language so the organizer confirms before moving on.

## NOTE on Figma access
The mentor cannot open the Figma file (it's connected to the AI/Claude Code session, not the mentor). The AI should open the competition-creation frames in Figma directly (node-id from the PoolDN file) and match each step's fields, labels, order, and the per-step confirmation text exactly.

## Tests
- Stepper: the active step is visually distinct from completed/future; labels render; clicking a past step navigates.
- Blocked Next shows a clear error (e.g., empty Structure) instead of doing nothing.
- An organizer can complete all steps end-to-end and reach Review & Publish, then publish.

## Definition of done
The wizard shows labeled steps with a clearly distinct current step (Figma-matched); Next never fails silently (validation errors are surfaced) so Review & Publish is always reachable; the step list matches Figma; e2e covers reaching and publishing from Review & Publish.
