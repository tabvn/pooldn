# PoolDN — Player Landing / Public Profile (Round 17)

A public player profile page that anyone (guest/viewer/any role) can view, and that the player sees as their own. Match the Figma player/profile frame via the Figma MCP if one exists; otherwise design consistent with the system tokens.

## Route + visibility
- Public route, e.g. `/players/[username]` (or `/u/[username]`). Readable by **guest, viewer, and all roles** (CASL: User read is public for profile fields). Private fields (email, phone) are NOT exposed publicly.
- **Self view**: when the viewer is the profile owner, show an **"Edit profile"** affordance (links to Settings) and any private-to-self info.
- Link to it from: the Players stat tables (competition Players tab), team rosters, community posts (avatar/name), and match lineups — every place a player name/avatar appears deep-links here.

## Sections
1. **Header**: avatar (uploaded image, initials fallback), full name, @username, **nationality flag**, city, role badge (Player / Captain / Organizer / Admin), short bio. Self-view: Edit profile button.
2. **Career stats**: matches played, frames won / played, win %, MVP count/awards, competitions played, current teams. (Aggregate from MatchParticipant + PlayerCompStat.)
3. **Teams**: teams the player is a member or captain of (with logos), linking to each team.
4. **Competitions**: competitions the player has participated in (with status + their result/standing).
5. **Recent match history**: recent matches with opponents, scores, and result.
6. Empty/loading states for a brand-new player (no stats yet).

## Onboarding tie-in
- After sign-up, the profile is the player's home; an onboarding step (name, avatar, city, nationality) populates it (round-12 TASK 4).
- A new player can be invited to / request to join teams (round-13) and then becomes selectable in lineups; their profile then accrues stats.

## Permissions
- Public read of profile + public stats. Only the owner edits (via Settings / updateProfile). No private fields leak.

## Tests
- Guest/viewer can open `/players/[username]` and see name, avatar, stats, teams, competitions — but not email/phone.
- Owner sees Edit profile; editing avatar/bio/city persists and shows on the public page.
- Deep-links from Players tab / roster / community / lineup all resolve to the right profile.
- New player (no stats) shows a clean empty state.

## Definition of done
Public player landing renders for any viewer with stats/teams/competitions/history, self-view offers edit, private fields are protected, all entry points deep-link correctly, Figma-matched (verify via MCP), console-clean, Playwright-covered.
