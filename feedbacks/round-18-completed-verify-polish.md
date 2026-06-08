# PoolDN — Completed Screen Verify + Polish (Round 18)

Re-tested the Completed competition (Da Nang International Pool League) live as a captain. The screen WORKS and largely matches the Figma "Competition / Results" frame:
- Overview: COMPLETED badge, **Winner (Gen Filling Station) / MVP (Thomas Bryan)** banner ✓, final League Standings with rank highlighting ✓.
- **Matchdays = results archive** ✓ (Matchday 1 — Opening Day, Gen Filling Station 5–3 Da Nang Tigers, COMPLETED).
- **Players = leaderboard** ✓ (Matches, Frames won/played, Win %, MVP tag).

## Polish gaps to fix (match the frame exactly)
1. **Images render as initials, not real images.** The winner banner, standings rows, and player rows show initials (GF, DN, TB) instead of team **logos** / player **avatars**. Wire the uploaded images (round-8 media) into: winner/MVP banner, standings team cell, players avatar. The Figma shows actual logos/avatars.
2. **MVP nationality flag missing.** The Figma MVP shows the player's nationality flag next to the name (the banner shows "Thomas Bryan (CA)" as plain text). Render the flag icon.
3. **MVP derivation looks off.** MVP = Thomas Bryan (50% win) while Gen Hoang has a higher win % (63%). Confirm the MVP rule: if it's "highest win% / frames won", the flag is on the wrong player; if MVP is a manual/awarded flag, keep it but make the criteria explicit. Either way, verify `PlayerCompStat.isMvp` is set by the intended rule on completion.

## Otherwise
No functional bugs on the Completed screen — tabs, results archive, and leaderboard all work and authz is correct (captain sees Follow, no organizer kebab). This is a small polish pass, not a rebuild.
