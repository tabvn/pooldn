# PoolDN — Figma fidelity audit (Round 49, in progress)

Going screen-by-screen through the Figma (read via browser) and recording the exact spec + gaps vs the build. The competition CREATION flow is covered in detail in **round-48** (major rebuild needed). This file tracks the rest.

## ✅ Competition Ongoing — Overview (node 299-11234) — largely MATCHES
Figma: header (name, Active status, dates, prize) + tabs **Overview · Matchdays · Players · About** (Overview active, green) + **League Standings** table with columns **# · Team · P · W · D · L · PF · PA · Pts**, leader row highlighted, legend below.
Build: the live competition page has the same Overview/Matchdays/Players/About tabs + a full standings table. **Close match — no major gap here.** (Minor: confirm the active-tab green styling + standings row highlight/legend match exactly.)

## ✅ Competition Pre-Start — Applications (node 356-19455) — roughly MATCHES
Figma: header (name, Active, dates, teams, prize) + **Apply** button; tabs **Applications · Matchdays · Players · About**; "Ready to Compete? / Apply as a Team" hero CTA; **Confirmed Teams** table (Team · Captain/Roster Captain · status · points). Build has the Apply CTA + tabbed competition page + applications — close. (Confirm the "Confirmed Teams" table columns + the hero CTA styling match.)

## Summary so far
- **Competition CREATION flow** — the big divergence (round-48): wrong tab set/order, missing How-Participants-Apply, missing Schedule toggles (Where-Played / Games-per-Opponent / Weekly-vs-Fixed), missing per-step summaries, dots instead of labeled tabs.
- **Competition Ongoing (Overview)** and **Pre-Start (Applications)** — largely match the build.
So the lifecycle VIEW screens are on-track; the creation/SETUP flow is what needs the rebuild.

## ⏳ Still to audit (cluster by cluster)
- **Competition Pre-Start**: Applications (organizer review), Matchday Generation, Players, About.
- **Competition Ongoing**: Matchdays, Players, About tabs (only Overview audited).
- **Competition Completed**: champion/MVP banner, final standings, recap.
- **Match Flow — Captain View**: lineup submission, frame/score entry, score confirmation.
- **Team Captain Application** flow.
- **Auth/Onboarding**, **Dashboard/Poolhub**, **Teams**, **Venues**, **Community**.

## Method note
Each Figma frame is read by zooming to it in the browser and screenshotting. The competition CREATION flow (round-48) was the biggest divergence found so far; the Ongoing Overview is close. Continue capturing the remaining clusters and append findings here with exact field/label/spec differences.
