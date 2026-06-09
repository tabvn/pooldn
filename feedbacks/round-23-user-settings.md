# PoolDN — User Settings (Avatar / Email / Password) Review + Improvements (Round 23)

Reviewed from code (browser was disconnected — verify live once reconnected). Settings is already solid: tabbed **Profile** + **Account**, Profile has avatar upload (ImageUpload + crop) + name/bio/nationality/city with zod validation + toasts; Account has **Change email** (new email + confirm with current password, collapsible) and **Change password**, with error toasts. `changeEmail`/`changePassword` mutations exist.

## Improvements
1. **Email-change verification (important).** `changeEmail` currently swaps the email immediately after current-password check. For production, send a verification link to the **new** address and only switch once confirmed (use `User.emailVerified` — set false on change, show an "unverified — resend" state). At minimum, document the trade-off; ideally implement the verify step.
2. **Email verification status UI.** Show a Verified/Unverified badge next to the email with a "Resend verification" action (the `emailVerified` field exists).
3. **Password section polish.** Ensure it has: current password, new password, **confirm new password** (must match), and a basic **strength indicator** + min-length rule; success toast + clear-on-success.
4. **Nationality → country picker.** It's a free-text "short code (max 8)" today; replace with a proper country dropdown (ISO-2) — also fixes onboarding (the AI flagged this).
5. **Danger zone.** Add a "Deactivate / Delete account" section (uses `User.isActive` for soft-deactivate) with a strong confirm (type username). Admin-only hard delete elsewhere.
6. **Profile completeness.** Avatar crop should be wired here too (reuse the avatar-crop modal); show the current avatar prominently.
7. **UI/Figma.** Match the Figma settings frame: consistent tab styling, section cards, spacing, and the design tokens; clear save/cancel affordances and dirty-state handling (Profile already has `isDirty`).
8. **(Optional) Notification preferences** section (email/push toggles per notification type) if in scope.

## Tests
- Change email with correct current password → updates (and, if implemented, triggers verification + sets emailVerified=false). Wrong password → clear error, no change.
- Change password: current+new+confirm; mismatch and weak password rejected with inline errors; success toast; can log in with the new password.
- Avatar upload + crop persists and shows everywhere (reuses the global Avatar).
- Country picker sets a valid ISO-2 nationality used by the flag component.
- Deactivate account flow (if added) with confirm.

## Definition of done
Settings matches the Figma settings frame; email change is verification-safe; password change has confirm + strength; nationality uses a country picker; avatar crop wired; optional danger zone; validated + toasted + tested.
