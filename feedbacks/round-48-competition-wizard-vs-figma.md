# PoolDN — Competition creation flow DOES NOT match Figma (Round 48, verified in Figma)

I reviewed the actual Figma frames (node 166-2613 "Competition Creation Flow", and the "Draft Competition" Step 1–4 frames). The implemented wizard (`app/(shell)/competitions/new/form.tsx`) diverges badly. Rebuild it to match Figma exactly.

## Overall structure (Figma)
1. **"Create New Competition"** — a first standalone form for the Basics (name, game, format, type, start date, prize). Creates the DRAFT (toast: "Competition Draft has been created").
2. Then the draft page shows **pre-start setup as 4 LABELED TABS**, current tab highlighted **green**:
   **1. Participants · 2. Schedule · 3. Structure · 4. Review & Publish**
   (Tabs/segmented control with the step number + name — NOT unlabeled progress dots. Only 4 steps, in this order: Participants → Schedule → Structure → Review & Publish.)

**Build today (wrong):** one 6-step wizard — Basics · Participants · **Schedule · Structure** · Season preview · Review & Publish — with thin **unlabeled dots** where current and completed look identical. Wrong step count, wrong labels, wrong indicator, extra "Season preview" step.

## Step: Participants (Figma)
- **"How Participants Apply?"** → segmented toggle: **Anyone Can Apply** | **Invite Only**  ← MISSING in build
- **"Max Amount of Participants (Teams)"** → number (e.g. 24)
- **"Min and Max Amount of Players per Team (Roster)"** → Min | Max (e.g. 3 / 10)
- **Confirmation summary box** (highlighted): *"Any team can apply. Max 24 participants. Team roster size 3 to 10 players"*  ← MISSING in build
- Button: **"Save and Continue"**

## Step: Schedule (Figma)  ← build is almost entirely wrong here
- **"Where Matches Are Played?"** → **Team Venues** | **Central Venue** (hint: "Teams will have games in their home venues")  ← build only has an optional City dropdown
- **"Games per Opponent"** → **Home & Away** | **Only Once** (hint: "Each team plays twice (home & away) against every other team")  ← MISSING in build
- **"Scheduling Type"** → **Weekly Rounds** | **Fixed Match Day(s)**; for Weekly Rounds, repeatable rows "Every [weekday] at [time]" + **"+ Add Weekday"**  ← build has a generic FIXED_DATE/FLEXIBLE/AUTO_GENERATED select + matchday count instead
- **Confirmation summary box**: "Each team will play home and away games at Team Venues · Games will happen every Tuesday at 9:00 PM and every Friday at 9:00 PM · Season Calendar will be generated after teams confirmed"  ← MISSING
- Button: **"Save Schedule Settings"**

## Step: Structure (Figma)
- Heading: **"Build your match layout by adding game blocks"** / "Drag & Drop to Reorder Match Layout"
- Numbered, **drag-reorderable** game-block list with delete (✕): e.g. 1–3 **Singles Game (1 vs 1)**, **Break Time**, 4–5 **Doubles Game (2 vs 2)**, **Break Time**, 6–8 **Singles Game (1 vs 1)**
- Add controls: **+ Singles | + Doubles | + Break**
- **Confirmation summary box**: *"Teams will play 8 games per match: 6 singles and 2 doubles. Team Captains will assign players before the match and/or during the breaks"*  ← MISSING
- Button: **"Save Structure"**
- (Build has a structure builder but with different UX and no summary/break-as-a-block model — align to Figma.)

## Cross-cutting (apply to ALL steps)
- **Labeled tab stepper** with a clearly distinct **active (green)** tab, completed vs upcoming states; matches Figma, not dots.
- **Per-step confirmation summary box** that restates the chosen values in plain language (every step has one).
- Per-step **Save** button wording from Figma ("Save and Continue", "Save Schedule Settings", "Save Structure").
- These are **segmented toggles** (Anyone/Invite, Team/Central, Home&Away/Once, Weekly/Fixed), not plain selects.
- Schema/GraphQL likely needs new fields: `applicationMode` (OPEN/INVITE), `venueMode` (TEAM_VENUES/CENTRAL), `gamesPerOpponent` (HOME_AWAY/ONCE), and a weekly-rounds schedule (weekday+time list). Wire these into matchday generation.

## Tests
- Wizard renders the 4 labeled tabs in order with the active tab visually distinct.
- Participants shows How-Participants-Apply + the summary; Schedule shows Where-Played + Games-per-Opponent + Weekly/Fixed + summary; Structure shows the block builder + summary.
- Each step's summary text reflects the entered values.

## Definition of done
The competition creation flow matches Figma: Create-New-Competition (basics) → 4 labeled tabs (Participants · Schedule · Structure · Review & Publish) with a distinct active tab; Participants has How-Participants-Apply; Schedule has Where-Matches-Are-Played + Games-per-Opponent + Scheduling-Type (weekly rounds); Structure has the block builder; every step shows its confirmation summary and Figma Save button; backed by the new fields; tested. **The AI should open these Figma frames directly (node 166-2613 + the Draft Competition Step 1–4 frames) and match pixel-for-pixel.**
