# PoolDN — Feature Completion Plan (CRUD, Media, Follow)

Grounded in a code audit of `lib/graphql/resolvers/*` and `app/*`. Goal: complete every entity's create/read/update/delete, image upload, and the follow feature — each with Figma-exact UI/UX, validation, toasts, confirm dialogs, empty/loading/error states, CASL permissions, and tests.

## Current state (audit)
Mutations that EXIST: register, login, logout, createUser, updateProfile, createCompetition, publishCompetition, startCompetition, closeApplications, completeCompetition, cancelCompetition, generateMatchdays, createTeam, addTeamMember, removeTeamMember, applyToCompetition, reviewApplication, recordMatchFrame, submitMatchResult, createCommunityPost.

MISSING (the gaps to close):
- **No `updateCompetition`, no `deleteCompetition`.**
- **No `updateTeam`, no `deleteTeam`.**
- **No venue mutations at all** — venues are read-only (no create/update/delete, no `/venues/new`, no edit page).
- **No image upload** anywhere — no upload route, no storage, no file inputs. `avatarUrl`/`logoUrl`/`bannerUrl`/`imageUrl` are URL-only and unused in forms.
- **No Follow/favorite** model or feature.

## A. Media upload (foundational — do first; everything else depends on it)
- Add an upload route handler `app/api/upload/route.ts` (POST, multipart). Dev: write to `public/uploads/{entity}/{id}` and return the public path; structure it so a swap to object storage (S3/R2) later is trivial. Validate type (png/jpg/webp), max size, and auth (only the owner can upload for their entity).
- Build a reusable `<ImageUpload>` component (drag/drop + click, preview, progress, remove, fallback to initials/placeholder) using the Figma styling.
- Wire it into: Profile avatar (`avatarUrl`), Team logo (`logoUrl`), Competition banner (`bannerUrl`), Venue image (`imageUrl`). Show the uploaded image everywhere those entities render (cards, headers, avatars) instead of initials-only.
- Security: never trust client paths; store server-resolved paths; gate by CASL (owner/captain/organizer/admin).

## B. Venues — full CRUD (currently read-only)
- Mutations: `createVenue`, `updateVenue`, `deleteVenue` (soft-delete via `isActive`). CASL: ORGANIZER/SUPER_ADMIN create/manage; everyone reads active venues.
- Pages: `/venues/new` (create form), `/venues/[slug]/edit` (edit), and an admin/owner "Edit"/"Add venue" CTA on the venues list + detail. Fields: name, slug, address, city (select), phone, email, website, tableCount, image (upload). Match the Figma venue frames.
- Venue detail: show image, table count, contact, and matches hosted there.

## C. Competitions — add update + delete
- `updateCompetition` (edit while DRAFT / pre-start; restrict which fields are editable once OPEN/ONGOING). `deleteCompetition` (only DRAFT, soft or hard with cascade safety). CASL: organizerId === actor or SUPER_ADMIN.
- UI: "Edit" in the organizer kebab on the Pre-Start/detail view → the create WIZARD reused in edit mode (prefilled). Banner image via `<ImageUpload>`. Confirm dialog on delete.

## D. Teams — add update + delete
- `updateTeam` (name, logo, description), `deleteTeam` (soft-delete; block if active competition participation). CASL: captainId === actor or SUPER_ADMIN.
- UI: "Edit team" on team detail / manage (reuse the create form in edit mode), logo via `<ImageUpload>`, confirm on delete.

## E. Profile — avatar + edit
- Profile edit form (name, bio, phone, nationality, city, avatar upload) via `updateProfile`. Avatar shows uploaded image; initials fallback. Settings page = self-edit only.

## F. Follow / favorite (new feature)
- Schema: `Follow { id, userId, entityType (COMPETITION|TEAM), entityId, createdAt, @@unique([userId, entityType, entityId]) }`.
- Mutations: `followEntity` / `unfollowEntity`; query `myFollows` + `isFollowing` field on Competition/Team.
- UI: a Follow/Following toggle button on competition detail and team detail (optimistic). 
- Integration: surface followed competitions/teams on the Poolhub **dashboard** (a "Following" section) and fire notifications for followed entities (e.g., a followed competition starts, a followed team's match is scheduled) via the existing `NotificationService` fan-out.

## G. Permissions (CASL) — add rules for every new mutation
Venue manage (organizer/admin), updateTeam/deleteTeam (captain/admin), updateCompetition/deleteCompetition (organizer/admin), follow (any signed-in user), upload (owner of the target entity). Add per-role tests; a non-owner must be blocked from each update/delete.

## H. UI/UX standard for every screen (non-negotiable)
- Match the Figma frame via the Figma MCP: layout, spacing, type scale, color tokens (Mist/Primary/Teal/Amber/Sky/Pink), the shared AppShell (sidebar icons + active pill, header flag + account dropdown).
- Every create/edit form: inline validation (zod + RHF), disabled/loading submit, success toast, error toast, and a confirm dialog on every destructive action.
- Every list/detail: empty state, loading skeleton, and error state. Images render (no permanent initials where an image exists).

## I. Tests (Playwright + unit)
For each entity: create → read → update → delete happy path; permission-denied path for a non-owner; image upload happy + reject (bad type/size). Follow: follow → appears in dashboard "Following" → unfollow. Extend the role matrix in round-7 to cover venue CRUD, competition/team edit, profile avatar, and follow.

## Order of work
1. Media upload infra + `<ImageUpload>` (unblocks all image fields).
2. Venues CRUD (biggest missing surface).
3. Competition edit/delete + Team edit/delete (reuse wizard/forms in edit mode).
4. Profile avatar/edit.
5. Follow feature + dashboard "Following" + notifications.
6. CASL rules + tests for all of the above; full green run.

Use the Figma MCP for every screen. Report each feature as it's completed with a screenshot.
