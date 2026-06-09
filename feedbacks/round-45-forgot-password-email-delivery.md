# PoolDN — Forgot-password "doesn't work": email delivery fails silently (Round 45)

## What actually works
The forgot-password flow is correctly built end to end:
- `/forgot-password` (no token) → request form → `requestPasswordReset(email)` returns `true` (verified live for `toan@thebay.city`), issues a `PASSWORD_RESET` email-token (60-min TTL), rate-limited + anti-enumeration. UI shows "Check your inbox."
- `/forgot-password?token=…` → reset form (new password + confirm) → `resetPassword(token, newPassword)` → redirect to `/sign-in`.

## The real problem: the email never arrives, and the failure is hidden
`.env` configures **real Gmail SMTP** (`SMTP_HOST=smtp.gmail.com`, `SMTP_USER=toan@thebay.city`, `SMTP_PASSWORD=set`), so `email.service.ts` tries an actual send (not the dev console fallback). But `requestPasswordReset` fires the send **fire-and-forget with a swallowed catch**:
```ts
void sendPasswordReset({...}).catch((e) => console.warn("[requestPasswordReset] send failed:", e));
```
So if the Gmail send fails, the mutation still returns `true`, the UI still says "Check your inbox," and **no email is delivered** — exactly the "seems doesn't work" symptom. Most likely cause: Gmail rejects the login with `535-5.7.8 Username and Password not accepted` because `SMTP_PASSWORD` is a normal account password rather than a **Gmail App Password** (16-char, requires 2-Step Verification). Other possibilities: the `toan@thebay.city` domain isn't a Google Workspace account authorized for `smtp.gmail.com`, or sending is blocked.

## Fixes
1. **Credentials:** use a Gmail/Workspace **App Password** for `SMTP_PASSWORD` (enable 2-Step Verification first). Confirm the `SMTP_USER` account is allowed to send via `smtp.gmail.com:465` (secure). Document this in `.env.example`.
2. **Stop hiding failures (P1):** don't swallow the send error. Options: log it at `error` level with the SMTP response code; record a `email_delivery` audit row (sent/failed + provider message); in non-production, expose a **dev outbox** (e.g., `/dev/outbox`, gated to `NODE_ENV !== "production"`) listing the last N emails with their reset links so testers can complete the flow without reading server logs or wiring SMTP.
3. **Verify (don't break anti-enumeration):** keep the mutation returning `true` regardless, but add an internal health signal — e.g., a startup `transporter.verify()` check that logs loudly if SMTP auth fails, so a misconfigured mailer is obvious at boot.
4. **Optional dev convenience:** if `SMTP_*` is set but `verify()` fails at boot, fall back to the console-logging transport so the link is still printed (and warn).

## How to confirm the current failure
Submit forgot-password for `toan@thebay.city` and watch the **dev server console** for `[requestPasswordReset] send failed:` / nodemailer `EAUTH`/`535`. That line confirms it's an SMTP auth/delivery failure, not the app logic.

## Definition of done
Reset emails actually deliver with valid SMTP creds; SMTP/send failures are logged (not swallowed) and visible at boot; a dev outbox (or console fallback) lets testers complete the reset without real email; `.env.example` documents the App Password requirement; e2e covers request→token→reset→sign-in.
