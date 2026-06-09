# PoolDN — Google Sign-In (OAuth 2.0 / OIDC) best-practice integration (Round 46)

> **STATUS: v1 IMPLEMENTED by the mentor — DO NOT re-implement / duplicate.**
> Working code already added (no schema change, no new dependency):
> - `lib/auth/google.ts` — PKCE + state + nonce, `buildAuthUrl`, `exchangeCode` (fetch), `verifyIdToken` (jose JWKS: verifies signature, `aud`, `iss`, `exp`, `nonce`, `email_verified`).
> - `app/api/auth/google/start/route.ts` — sets short-lived httpOnly cookies, redirects to Google; redirect URI derived from request origin.
> - `app/api/auth/google/callback/route.ts` — validates state, exchanges code, verifies ID token, **finds user by verified email (login as that account, backfill avatar/verified) or creates a new PLAYER** pre-filled from Google (name + avatar, email pre-verified; random bcrypt password so the non-null column is satisfied), mints `pooldn_session`/`pooldn_refresh` via existing helpers. **New accounts redirect to `/onboarding`** (review/complete the Google-filled profile); returning users redirect to `next`. Google button carries `?next=`.
> - `components/auth/social-buttons.tsx` — Google button enabled → links to `/api/auth/google/start`.
> - `app/(auth)/sign-in/page.tsx` — renders friendly `?authError=` messages.
> - `.env.example` + `.env` — `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` keys added (empty; user pastes real values).
> Verified: build compiles; `/api/auth/google/start` → `/sign-in?authError=google_unconfigured` until creds are set; error banner renders.
>
> **Remaining (optional hardening the AI MAY add — don't rebuild the above):**
> - Migrate to an `OAuthAccount` table + make `User.password` nullable (multi-provider, cleaner than matching purely by email). Backfill: link existing Google users by their current email on first OAuth login.
> - Add e2e coverage (mock the Google token endpoint/JWKS) for: new-user create, returning-user login, verified-email link, state-mismatch reject, email_verified=false reject.
> - Pass `next` through the Google button (currently defaults to `/`).
> The original best-practice spec below is retained for reference.

---


Add "Continue with Google" to the existing **custom JWT auth** (don't replace it with NextAuth). Use the **Authorization Code flow with PKCE + state + nonce**, verify the Google **ID token** server-side, then mint the app's own `pooldn_session` cookie (reuse `signSessionToken`/`signRefreshToken` + `buildCookie`).

**Decisions (locked):**
- Consent screen = **External** (thebay.city is not a Workspace domain). While in "Testing," only added test users can sign in; **publish** the consent screen for true public access.
- Audience = **public sign-up**: any Google account with a **verified** email may sign in; unknown verified emails **create** a new `User` (role `PLAYER`). (So implement the create-on-first-login branch, not the reject-unknown branch.)

## Library
Use the official **`google-auth-library`** (`OAuth2Client`): `generateAuthUrl`, `getToken` (code→tokens), and `verifyIdToken` (validates signature against Google JWKS + `aud` + `iss` + `exp`). Minimal, official, no hand-rolled crypto. (Alt: `arctic` if you prefer a tiny generic OAuth2 client — but google-auth-library is the safest default.)

## Schema (migration)
- **Make `User.password` nullable** (`String?`) — OAuth-only users have no password. Update `loginUser` to reject password login for passwordless accounts with a friendly "Use Google to sign in."
- Add a provider table for extensibility (Facebook is also "coming soon"):
  ```prisma
  enum AuthProvider { GOOGLE FACEBOOK }
  model OAuthAccount {
    id                String       @id @default(cuid())
    provider          AuthProvider
    providerAccountId String       // Google "sub"
    userId            String
    user              User         @relation(fields: [userId], references: [id], onDelete: Cascade)
    createdAt         DateTime     @default(now())
    @@unique([provider, providerAccountId])
    @@index([userId])
  }
  ```
  (A single `User.googleId String? @unique` column also works, but the table generalizes to Facebook cleanly.)

## Routes (App Router handlers, like the existing `/api/*`)
1. **`GET /api/auth/google/start`**
   - Generate `state` (random), PKCE `code_verifier` + `code_challenge` (S256), and `nonce`.
   - Store `state`, `code_verifier`, `nonce`, and the sanitized `?next=` in **short-lived httpOnly, SameSite=Lax** cookies (Lax so they survive the redirect back; ~10 min TTL).
   - `302` to Google authorize URL with `scope="openid email profile"`, `response_type=code`, `code_challenge`+`method=S256`, `state`, `nonce`, `access_type=online`, `prompt=select_account`, exact `redirect_uri`.
2. **`GET /api/auth/google/callback`**
   - Handle `?error=` (user denied) → redirect `/sign-in?authError=google_denied`.
   - Validate `state` == cookie (CSRF). Exchange `code` + `code_verifier` at the token endpoint.
   - **Verify the ID token**: signature (Google certs), `aud === GOOGLE_CLIENT_ID`, `iss ∈ {accounts.google.com, https://accounts.google.com}`, not expired, `nonce` matches, and **`email_verified === true`**.
   - Resolve the user (transaction):
     - `OAuthAccount(GOOGLE, sub)` exists → that user.
     - else a user with the **verified** `email` exists → **link** (create `OAuthAccount`, set `emailVerified=true`). Only auto-link verified emails (prevents account takeover).
     - else **create**: `name` from profile, `username` via `pickAvailableUsername`, `avatarUrl` from Google `picture`, `emailVerified=true`, `role=PLAYER`, `password=null`, + `OAuthAccount`.
   - Mint session: `signSessionToken` + `signRefreshToken`, set `pooldn_session`/`pooldn_refresh` via `buildCookie` on the redirect response. Clear the temp state/verifier/nonce cookies.
   - `302` to the stored `next` (default `/`). Block open-redirects: only allow same-origin relative paths.

## Frontend
- In `components/auth/social-buttons.tsx`, enable the Google button (remove "coming soon"): it navigates to `/api/auth/google/start?next=<current>` (anchor or `window.location.assign`). Keep Facebook disabled.
- On `/sign-in`, render `?authError=` messages (denied / email-unverified / linking-conflict).
- Show the Google button on both `/sign-in` and `/sign-up` (same endpoint).

## Security checklist
- PKCE (S256) + `state` (CSRF) + `nonce` (replay) — all required.
- Verify ID token aud/iss/exp/signature/email_verified before trusting identity.
- `GOOGLE_CLIENT_SECRET` server-only (env); never sent to the client; redirect URI must exactly match a registered one.
- `access_type=online` (no refresh token / offline scope — we only need identity).
- Cookies httpOnly, `Secure` in prod, `SameSite=Lax`; temp OAuth cookies short-TTL + cleared on callback.
- Don't auto-link unverified emails. Rate-limit the callback. Log failures (audit) without leaking which emails exist.

## Env (you add after console setup — do NOT commit secrets)
```
GOOGLE_CLIENT_ID="...apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="..."
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/google/callback"
```
Document these in `.env.example` (placeholders only).

## Tests
- New-user sign-in creates a User + OAuthAccount, sets the session, lands on `next`.
- Returning Google user logs in without duplicate accounts.
- Existing email + Google (verified) links rather than duplicating.
- `state` mismatch / tampered code / `email_verified=false` are rejected.
- Password login still works for password users; passwordless users get the "use Google" message.
- e2e: button → (mock Google) → logged-in identity visible.

## Definition of done
"Continue with Google" completes Authorization-Code+PKCE, verifies the ID token, links/creates the user, issues the app session, and lands logged-in; schema migrated (nullable password + OAuthAccount); secrets in env; security checklist satisfied; tests green.
