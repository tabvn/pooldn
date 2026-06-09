# PoolDN — Pending-invite banner on the team page (Round 33)

When a signed-in user views a team page and **that team has a pending `TeamInvitation` for them**, show a prominent **Accept / Decline banner** right on the team detail page (in addition to `/invitations`). Nice, clear UI.

## Behavior
- On `/teams/[slug]`, expose the viewer's invitation for this team — e.g. `team.myInvitation { id status invitedBy { name } }` (or filter the viewer's invitations by teamId).
- If a **PENDING** invite exists, render a banner at the top of the page (above/within the header):
  - Team logo + "**{Team} invited you to join**" + a sub-line ("Invited by {captain} · {date}").
  - **Accept** (primary) and **Decline** (secondary) buttons.
- **Accept** → `respondToInvitation(id, accept:true)` → viewer becomes a member (banner swaps to "You're on this team" + the page reflects membership/roster); captain notified; success toast.
- **Decline** → `respondToInvitation(id, accept:false)` → banner dismisses; captain notified; toast.
- If no pending invite (or already a member), no banner — show the normal **Request to join** (non-member) / **Manage** (captain) actions.

## UI/UX (nice)
- An accent-bordered/elevated banner card using the design tokens (lime/primary accent), team logo on the left, message + the two CTAs on the right; responsive; loading state on the buttons; confirm not required for accept, optional for decline.
- Match the Figma team frame; consistent with the rest of the app.

## Tests
- Captain invites @player → @player opens the team page → sees the Accept/Decline banner → Accept = becomes member (banner gone, in roster) + captain notified; Decline = banner gone + captain notified.
- A user with no invite from the team sees no banner (Request to join instead).
- Already-member / captain sees no banner.

## Definition of done
Viewing a team that invited you shows a clear Accept/Decline banner on the team page that drives `respondToInvitation`, updates the page + notifies the captain, with no banner otherwise; Figma-matched; tested.
