# PoolDN — Facebook Login (OAuth 2.0) (Round 47)

> **STATUS: v1 IMPLEMENTED by the mentor — DO NOT re-implement / duplicate.**
> Mirrors the Google integration (round-46), no schema change, no new dependency.
> - `lib/auth/facebook.ts` — OAuth2 with `state` (CSRF) + `appsecret_proof` on Graph calls; `buildAuthUrl`, `exchangeCode`, `fetchProfile` (Graph `/me?fields=id,name,email,picture`). Graph version via `FACEBOOK_GRAPH_VERSION` (default v21.0).
> - `app/api/auth/facebook/start/route.ts` + `app/api/auth/facebook/callback/route.ts` — same policy as Google: **match verified email → log into that account** (backfill avatar/verified); **else create a new PLAYER** pre-filled from Facebook (name + avatar) → redirect to `/onboarding`. Returning users → `next`. Random bcrypt password fills the non-null column.
> - `components/auth/social-buttons.tsx` — Facebook button enabled → `/api/auth/facebook/start?next=…`.
> - `app/(auth)/sign-in/page.tsx` — `facebook_*` authError messages.
> - `.env.example` + `.env` — `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` (+ optional `FACEBOOK_GRAPH_VERSION`).
> Verified: build compiles; start/callback redirect to `?authError=facebook_unconfigured` until creds are set.

## Important caveat — Facebook may not return an email
`email` requires the `email` permission (Meta **App Review** for public use) AND the user must have/share one. The callback handles the no-email case by redirecting to `/sign-in?authError=facebook_no_email` (asks them to use Google/email or grant email). **Proper fix = the `OAuthAccount` table from round-46:** key Facebook users by their FB `id` (`providerAccountId`), so returning users without an email still match, and only fall back to email/onboarding for brand-new ones. Until that lands, no-email Facebook users can't complete sign-in.

## Console setup (user does this in developers.facebook.com)
1. Create an app (type: Consumer) → add the **Facebook Login** product.
2. Facebook Login → Settings → **Valid OAuth Redirect URIs**:
   - `https://pooldn.thebaycity.dev/api/auth/facebook/callback`
   - `http://localhost:3000/api/auth/facebook/callback`
3. App domains / site URL: `pooldn.thebaycity.dev`, `localhost`.
4. Submit the `email` permission for **App Review** (and add a Privacy Policy URL + app icon) before going public; add yourself as a Tester to use it in dev meanwhile.
5. Copy **App ID** → `FACEBOOK_CLIENT_ID`, **App Secret** → `FACEBOOK_CLIENT_SECRET` in `.env`; restart the dev server.

## Data Deletion — using the Instructions URL (decided)
- We register Facebook's **Data Deletion Instructions URL** = `https://pooldn.thebaycity.dev/data-deletion` (the existing `/data-deletion` page). No signed-request callback, no `facebookId` column, **no migration**.
- The earlier callback experiment was reverted: `User.facebookId` removed from the schema, the login-time id write removed, and `app/api/auth/facebook/data-deletion/route.ts` reduced to a redirect to `/data-deletion` (harmless; not registered with Facebook).
- To make in-app deletion real end-to-end, wire a "Delete account" action in Settings → Account (separate task).

## Tests
- Configured app: button → Facebook dialog → callback creates/links user → onboarding/next.
- No-email account → `facebook_no_email` message (until OAuthAccount table lands).
- state mismatch rejected; existing email links rather than duplicating.

## Definition of done
"Continue with Facebook" completes OAuth, reads the profile (appsecret_proof), links/creates the user (avatar from FB), routes new users to onboarding; no-email handled; secrets in env; (follow-up) OAuthAccount table keys FB users by id; tests green.
