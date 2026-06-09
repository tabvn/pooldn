# PoolDN — Venue detail: show all home teams (Round 37)

On the venue detail page (`/venues/[slug]`), add a section listing **all teams whose home venue is this venue** ("Home teams"), alongside the existing venue info + matches hosted.

## Needs
- **Schema**: if `Team` has no `homeVenueId`, add `Team.homeVenueId String?` + relation to `Venue` (a venue has many `homeTeams`). Set it in the team create/edit wizard (round-35 basics: "home city/venue") and in the seed.
- **Query**: `venue.homeTeams` (cursor-paginated if many) — teams with `homeVenueId = venue.id`, with logo + name + captain + member count, deep-linking to each team.
- **UI**: a "Home teams" card/section on the venue detail page (avatars + names + counts), **Load more** if many; empty state ("No teams call this venue home yet"). Also keep/verify the **matches hosted here** list.
- Match the Figma venue frame.

## Tests
- A venue with N home teams lists them (paginated); each links to the team; empty state when none.
- Setting a team's home venue (wizard/edit) makes it appear on that venue's page.

## Definition of done
Venue detail shows its home teams (paginated, linked) + matches hosted; team home-venue is settable; seeded; Figma-matched; tested.
