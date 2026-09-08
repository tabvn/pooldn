<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
<!-- BEGIN:playpool-project-rules -->
# PoolDN project rules

## City is the top-level filter — stamp it, don't leave it NULL

Every list surface scopes to the header-selected city (`getHeaderCityId()`). `cityId` is nullable on `Competition`, `Team`, and `CommunityPost`, and the resolvers filter with **strict equality** — so a NULL-city row is invisible everywhere, with no error and no empty-state hint that anything was filtered out. This has already shipped as a user-visible bug once.

- Any new create flow for city-scoped content reads `getHeaderCityId()` **server-side in the page** and passes it into the mutation. Never leave it to default to NULL.
- Show the city as a **read-only field** sourced from the header selector, not a second picker — a create-time picker that disagrees with the header scope is how content gets filed where its author isn't looking.
- Adding a `cityId` filter to a resolver on a **nullable** column? Decide explicitly whether NULL means "global" (OR it in) or "unfiled" (exclude it), and say so in a comment.
- `getHeaderCityId()` auto-pins to the only active city when exactly one exists, overriding the `pooldn_city` cookie. "All cities" is currently unreachable — don't treat a Da Nang-scoped result as a bug.

## Competition copy must match the competition format

Round-robin/league competitions have a **season**, a **calendar**, and **matchdays**. Single-elimination competitions have a **bracket** that is **drawn** into **rounds** — they have no season. Branch on `format === "SINGLE_ELIMINATION"` (`isBracket` / `isElimination` in existing code) and switch the whole vocabulary, **including runtime-only strings — success and error toasts are what get missed**. Leave genuinely format-neutral sentences shared.

## Verify both sides of every branch before reporting done

Dashboard and competition surfaces branch on `viewer` (guest vs signed-in) and on organizer vs non-organizer. Changing one branch routinely leaves the other stale or leaks a CTA across. Load both states in the running app — not just a typecheck — before calling a UI change complete.
<!-- END:playpool-project-rules -->
