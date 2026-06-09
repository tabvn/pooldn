# PoolDN — Create Team as a multi-step onboarding wizard (Round 35)

Today `/teams/new` is a single form. Make it a guided **multi-step onboarding wizard** (consistent with the competition creation wizard styling) so a new captain sets up their team properly.

## Steps
1. **Basics** — team name (slug auto-derived + uniqueness check → friendly error, see round-31), **logo upload** (`<ImageUpload>` + crop), short description, home city/venue.
2. **Invite members** — search players (by name/username) or invite by email and queue invitations; show the queued invite list (removable). On finish, each becomes a `TeamInvitation` (PENDING) + `ROSTER_INVITE` notification (invite-only model from round-28 — the captain never auto-adds). Optional: skip for now.
3. **Review & Create** — summary (logo, name, city, description, the players being invited), then **Create team**. Creator becomes captain (`captainId`); invitations are sent.
4. **Done / confirmation** — "Team created!" with the team page link + next steps (apply to a competition, manage roster). Route to the team.

## UX
- Same wizard chrome as competition creation: header band with "Step N · {Title}", progress indicator, Back/Next, per-step validation (zod+RHF), Create only on Review.
- Logo preview + crop; queued-invite chips; friendly errors (slug taken, can't invite yourself/duplicates, max players).
- After creation, the captain lands on the team page; invited players get their `ROSTER_INVITE` notification + the on-team-page banner (round-33).

## Backend
- `createTeam` accepts the full payload (name, slug, logoUrl, description, cityId) AND an optional `invites: [userIdOrEmail]` → creates the team + fires the invitations in one transaction (or creates the team, then sends invites). Captain auto-set. Reuse `inviteToTeam` logic.
- Players (PLAYER role) can run this (round-30) — the "Create team" CTA is visible to players, especially in the "My Teams" empty state.

## Tests
- A player completes the wizard (basics + logo + invites + review) → team created with logo + captain = creator; invited players receive ROSTER_INVITE notifications; the captain can skip the invite step.
- Duplicate slug / self-invite / over-max are rejected with friendly messages.
- After create, the team page shows the new team + the captain; invited players see the accept banner (round-33).

## Definition of done
Create-team is a polished multi-step wizard (basics+logo → invite members → review → done) matching the competition-wizard styling; invites go out as ROSTER_INVITE (no auto-add); captain auto-set; Figma-matched; tested.
