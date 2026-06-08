# PoolDN — Test & UX Review (Round 1)

Tester: mentor pass over `localhost:3000`, logged in as Michael Dibbson, compared against the PoolDN Figma.

Legend: **P0** = blocking, **P1** = correctness bug, **P2** = UI/UX polish to match design.

---

## P0 — Build error breaks the Team Captain Application flow

`app/(shell)/competitions/[slug]/apply/form.tsx:57` fails to compile:

```
Nullish coalescing operator (??) requires parens when mixing with logical operators
> 57 | const maxPlayers = competition?.maxPlayersPerTeam ?? roster.length || 99;
```

Effect: visiting `/competitions/[slug]/apply` does not render — it bounces back to Poolhub. The entire apply/join flow is dead.

Fix: add parentheses, e.g.

```ts
const maxPlayers = (competition?.maxPlayersPerTeam ?? roster.length) || 99;
```

Then regenerate codegen and restart the dev server.

---

## P1 — Correctness / logic bugs

1. **Draft competitions are public on Poolhub.** The Poolhub list shows ~7 `DRAFT` competitions to a normal user (six "E2E Test League", "Mentor Test Cup", "Toronto Bayside Cup"). Drafts should be hidden from the public list and visible only to their organizer. Also purge / stop seeding the `e2e-*` test rows into the public feed.

2. **"Winner" / "MVP" shown while a competition is still ongoing.** On *Da Nang Autumn Invitational* (status ONGOING) the Overview headlines "Hai's Crew — WINNER" and "Gen Hoang — MVP", yet Matchday 3 is still upcoming and one match is IN_PROGRESS. Only render the winner/MVP banner when `status === COMPLETED`; otherwise show standings leader / "In progress".

3. **Rejected team appears in standings.** *Pool Sharks* is REJECTED on the Applications tab but still sits at position 4 in League Standings. Standings should only include APPROVED / participating teams.

---

## P2 — UI/UX polish (match Figma + make it nicer)

Competition detail (vs Figma "Competition Ongoing"):

- **Organizer actions → kebab menu.** Replace the row of big colored buttons (Close applications / Start / Cancel / Complete) with a single `⋯` overflow menu in the top-right, as in the design.
- **Metadata as icon-chips.** "Mar 1, 2027 – Jun 30, 2027  8,000,000 VND" should be icon + label chips: 📅 date range, 👥 player/team count, 🏆 prize.
- **Team avatars in standings.** The design shows a team logo/avatar beside each team name. Implementation shows text only. (Leader-green / bottom-row-red highlighting already matches — keep it.)

Create competition (vs Figma "Competition Creation Flow"):

- **Native selects/date inputs break the dark theme.** Game type / Format / Type / City use default `<select>`, dates use the native picker — they render light against the dark UI. Replace with styled custom dropdowns and a themed date picker.
- **Single long form vs multi-step.** Figma frames this as a stepped wizard ("Step 1") with a teal gradient header. Consider splitting Basics → Participants → Schedule/Prize into steps.

General:

- **Toasts on state changes** (start/close/complete/apply).
- **Confirmation dialogs** for destructive actions (Cancel / Complete competition).

---

## What's already good (keep)

- Dark theme + lime-green primary matches the Figma design system closely.
- Teams, Venues, Community (coming-soon), and competition detail tabs (Overview / Matchdays / Players / Applications) all render and look polished.
- Matchdays grouping by week, Players stat table with Win % and MVP tag, and Applications grouped by status are well done.

---

## Status
Posted to Claude Code session 01XUaCGEnqGTdg3FNjw6PpVt. AI was already mid-fix on form.tsx + match flow polish (103/103 tests) when feedback landed.
