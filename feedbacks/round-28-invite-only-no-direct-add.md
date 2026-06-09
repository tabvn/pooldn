# PoolDN — Team roster must be INVITE-ONLY (no direct add) (Round 28)

Checked `/teams/[slug]/manage`. The invite flow EXISTS and works (good): `inviteToTeam` creates a `TeamInvitation` + fires a `ROSTER_INVITE` notification, and `/invitations` shows the player an **Accept / Decline** with `respondToInvitation`. **Problem:** the manage page ALSO has a **"Add a player directly"** card (`addTeamMember`) that adds a player to the roster with **no consent** — this undermines the whole invitation model.

## Required change — invitation is the ONLY way to add a member
1. **Remove the "Add a player directly" card** from `app/(shell)/teams/[slug]/manage/roster.tsx` (≈ line 358). A captain can no longer drop a player onto the roster without consent.
2. The single path to add a member:
   - Captain **invites** a player (search existing user by name/username, or invite by email) → `inviteToTeam` → creates `TeamInvitation` (PENDING) + sends a **`ROSTER_INVITE` notification** to that player, deep-linking to `/invitations` (or an accept screen).
   - The **player** opens the notification / `/invitations` and chooses **Accept** or **Decline** (`respondToInvitation`).
   - On **Accept** → the player becomes a `TeamMember`; notify the captain "X accepted your invite."
   - On **Decline** → mark DECLINED; notify the captain "X declined your invite."
   - Manage page shows the **Pending invitations** list with a **Cancel** action (captain can revoke a pending invite).
3. **`addTeamMember`**: remove it from the captain UI. Keep the mutation only if needed for SUPER_ADMIN/seed (CASL-gated to admin); the captain flow must never call it.
4. Validation: can't invite an existing member or someone with a pending invite; respect max players per team; can't invite yourself.
5. Edge: if an invited email isn't a registered user yet, either gate to existing users for now, or store the email invite and bind it on signup (document which).

## UI/UX
- Manage page: keep the **"Invite a player"** card (search/email + Send invitation) + **Pending invitations** (with Cancel) + **Join requests** (approve/reject) — but NO direct-add.
- Player side: a clear Invitations area (notification deeplink → `/invitations`) with team name, who invited, Accept / Decline + confirm; toasts both ways.
- Match the Figma team-manage frame.

## Tests
- Captain invites @player → player gets a ROSTER_INVITE notification → opens /invitations → Accept → becomes a member + captain notified; Decline → not a member + captain notified.
- The manage page has NO "Add directly" control; a captain cannot add a member without an accepted invite.
- Duplicate/maxed/self invites are rejected with a friendly message.
- Cancel a pending invitation works.

## Definition of done
Roster membership is invite-only: invite → notification → player Accept/Decline; the direct-add UI is gone; captain never bypasses consent; notifications + toasts on every transition; tests green; Figma-matched.
