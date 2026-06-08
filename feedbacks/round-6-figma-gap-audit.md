# PoolDN — Figma Feature Audit + Gap Plan (Round 6)

Audited the Figma MVP page section-by-section against the build. The file is large (123 frames), and the **Claude Code session has the Figma MCP connected** ("Clients: Claude Code") — so use the Figma MCP to read each frame pixel-exact while closing the gaps below. This list is the prioritized structural gaps I found; treat the Figma as the source of truth for spacing/typography/tokens.

## Figma MVP sections (the intended feature set)
1. Auth / Onboarding (sign in / sign up)
2. Competition Creation Flow (stepped — "Step 1…")
3. Competition Pre-Start (draft detail + setup)
4. Competition Ongoing (Overview/Standings, Matchdays/Calendar, Players/MVP, About, Applications)
5. Team Captain Application (multi-step apply)
6. Match Flow — Captain View (match details + lineup submission + frame play)
7. Create New Team / New Team Created
8. Community
9. Poolhub Dashboard (home)

## P1 gaps (build differs materially from design)

### 1. Poolhub home should be a personalized DASHBOARD, not a flat grid
Design (frame "Welcome back, Michael!"):
- Greeting header: "Welcome back, {firstName}! / Ready to compete?"
- **Today's Match** widget — home vs away, score, status badge (Scheduled), venue line. Pulls the viewer's next/today match.
- **Upcoming Competitions** section — rich cards (type chip, format · game, start date, player count, prize, "Upcoming" badge).
- **Active Competitions** section with a **"View All"** link — teal-gradient "Active" cards.
- Sidebar promo (PoolDN Mobile App — Coming Soon), Suggest a Feature, Need Help.

Build today: a single flat grid titled "Poolhub / Public competitions…". Missing the greeting, Today's Match, and the Upcoming/Active sectioning + View All. Rebuild Poolhub as the dashboard; keep the full browse grid behind "View All" / a `/competitions` index.

### 2. Match Flow — full lineup submission flow (Captain View)
Design (frames "Match Details" + NOTE "Captains select match card on matchday; it opens match details with a lineup selection form"):
- **Match Details modal**: score header (teams, 0:0, Scheduled, venue).
- **Match Lineups**: "To start the match submit lineups. Lineups are hidden until both team captains submit their lineups."
- Lineup form with ordered slots — **Singles** rows (player dropdowns) and **Doubles** rows (two-player dropdowns), **Submit Lineup**, **Break Time for Next Lineup**.
- After both captains submit → reveal frames, play each frame, **select winner per frame**, then **"All games played — confirm"** to finalize → standings recompute + MATCH_RESULT_RECORDED fan-out.

Build today: `/matches/[id]/match-flow.tsx` has the frame/winner labels but the **lineup submission + "hidden until both submit" gating + singles/doubles slots** need verification/completion. Model support exists (`MatchFrame.homePlayer/awayPlayer`, `MatchParticipant`). Implement the captain lineup submission end-to-end and the both-submitted gate.

### 3. Competition Creation as a stepped wizard
Design shows "Create Competition / Step 1" framing (multi-step). Build is one long form. Convert to a stepped wizard (Basics → Participants → Schedule/Prize → Review) with the design's header treatment, or confirm the design intends a single page.

### 4. Header account menu
Design header: avatar + "{first} {last initial} ▾" opening an account dropdown (Profile / Settings / Sign out) + location selector + bell. Confirm the built header uses the dropdown menu (you added profile/settings) rather than an inline "Sign out".

## P2 / to verify against Figma (use the Figma MCP frame-by-frame)
- Competition **Pre-Start** state (draft): the organizer setup view (edit details, generate matchdays, open applications) — match the "Competition Pre-Start" section.
- **Team Captain Application**: confirm it matches the multi-step "Team Captain Application" frames (select team → roster/lineup → message → submit → confirmation).
- **Team detail** page (roster, captain, stats) and **Venue detail** page — confirm these exist and match design.
- **Profile** page and **Settings** — match design frames.
- Empty/loading/error states and toasts on every screen.

## Instruction
Use the Figma MCP to open each MVP section and implement pixel-exact (spacing, type scale, color tokens Mist/Primary/Teal/Amber/Sky/Pink). Prioritize P1 #1 and #2 (they're the biggest functional gaps). Keep tests green and add coverage for the new dashboard + lineup flow.
