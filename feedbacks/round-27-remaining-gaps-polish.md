# PoolDN — Remaining Gaps & Polish (Round 27)

Found via code audit while the AI worked through rounds 21–26. These are smaller but real (some are broken links). Queue after the current batch. Figma-match, tests, console-clean.

## P1 — broken sidebar links
- **`/help` and `/feedback` pages are missing**, but the sidebar shows "Need Help?" → `/help` and "Suggest a Feature" → `/feedback`. These likely 404. Build both:
  - `/help`: a simple help/FAQ page (how to create a competition, apply, submit scores, etc.) — static content is fine, match the app shell + Figma if a frame exists.
  - `/feedback`: a feedback form (subject + message) that creates a record/notification to admins (or a mailto/placeholder if no backend) + a thank-you state.
  - No sidebar link should 404.

## P1 — custom 404 / error pages
- Add a styled `app/not-found.tsx` (and a route-level `error.tsx`) matching the dark theme + shell — friendly "page not found / something went wrong" with a link home. Today it's Next's default.

## P2 — Community engagement
- Community has compose + feed + edit/delete own post, but **no likes or comments/replies**. Add:
  - Like/unlike a post (count + toggle).
  - Comments/replies on a post (thread), with the same media/avatar treatment and edit/delete-own.
  - Notifications when someone comments on / likes your post (via NotificationService).

## P2 — Competition rules document
- `Competition.rulesUrl` exists but the wizard never sets it. Add a **rules document** field (upload a PDF or paste a URL) in the wizard/edit, and show a "Rules" link on the competition About tab.

## P2 — Verify (need live, do when browser is stable)
- **Responsive / mobile**: the design is desktop-first; verify the shell + key screens degrade gracefully on narrow viewports (sidebar → drawer, tables → cards).
- **Empty + loading states** on every list/tab (skeletons), and **accessibility** (labels, focus, keyboard nav on the wizard/dialogs).
- **Toasts + confirms** present on every mutation (spot-check the new ones).

## Tests
- Visiting `/help` and `/feedback` renders (no 404); the feedback form submits.
- An unknown route shows the styled 404.
- Community: like toggles; comment posts + appears; author can edit/delete; notifications fire.
- Wizard: attach rules doc → About shows a Rules link.

## Definition of done
No sidebar link 404s; styled 404/error pages; community has likes + comments with notifications; rules document supported; responsive/empty/loading/a11y verified; tests green; Figma-matched.
