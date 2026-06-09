# PoolDN — /teams browse page UI/UX review (Round 39)

Reviewed `http://localhost:3000/teams` as a player (Linh). Solid foundation; below are the gaps to match Figma + the rest of the app.

## Working well (keep)
- All team logos/avatars render (no broken images); Captain/Member badges correct.
- "Manage" button only on the team the viewer captains (good role-awareness).
- Global "Search PoolDN…" box present in the header; mobile bottom nav present; "Create team" CTA prominent.

## Fix (priority order)
1. **Add a page-level filter/sort bar (P1).** The all-teams grid has NO controls. Add search-by-name, filter (city — scoped by header city per round-34, and/or "has open roster spots"), and sort (most members, A–Z, recently active). Reuse the competitions `<PoolhubFilters>` styling for consistency.
2. **Add "Load more"/pagination (P1).** Only 5 teams now, but the round-31 seed will overflow. Use the same cursor "Load more" pattern as the followers list (round-30).
3. **"Your teams" duplicates the all-teams grid (P2).** All 4 of the viewer's teams reappear in the grid below. Either exclude the viewer's teams from the main grid, or relabel the grid "Discover other teams" and filter them out.
4. **Unify the team-card component (P2).** "Your teams" renders compact rows (small avatar + badge + count + Manage) while the grid renders large cards (big logo + count pill + name + captain). Two visual languages for the same entity on one page. Either reuse one card everywhere, or make "Your teams" an explicit compact quick-access rail distinct from the canonical grid card.
5. **Add an explicit CTA on grid cards (P2).** Cards are whole-card links with no visible action. For non-member teams show "View" / "Request to join"; for followed/follow show a Follow toggle. Improves affordance over relying on whole-card click.
6. **Copy fix (P3).** Subtitle "Every team currently active across PoolDN competitions." is inaccurate — teams exist independent of competitions. Use "All active teams on PoolDN."
7. **Verify empty state (P3).** With no teams, the page should foreground the Create-team wizard CTA (round-35) and a friendly empty illustration.

## Tests
- Filter/sort narrows and reorders the grid; respects header city; Load more paginates the seeded teams.
- Viewer's teams don't appear twice; non-member cards expose a join/view CTA; captain sees Manage.

## Definition of done
Teams browse has a consistent filter/sort bar + Load-more, one unified team-card, no duplicate listing, explicit per-card CTAs, accurate copy, and a proper empty state — matching Figma and the competitions browse.
