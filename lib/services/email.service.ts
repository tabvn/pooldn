/**
 * Round-47 — outgoing email service (Gmail SMTP via nodemailer).
 *
 * Single transporter cached at module scope so repeated sends share the
 * TLS connection. In dev with SMTP_USER unset, sends are LOGGED to the
 * server console instead of actually fired — this keeps the auth flow
 * working when developers haven't wired up SMTP locally.
 *
 * Templates are tiny inline HTML; nothing fancy. If we need rich
 * templating later, drop in MJML or React Email and render in `send()`.
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { pushOutbox, type OutboxEntry } from "./email-outbox";

export { getOutbox, type OutboxEntry } from "./email-outbox";

// Project standardized on NEXT_PUBLIC_APP_URL for absolute off-site links
// (see .env.example "Public origin"). Fall back to legacy APP_URL or
// localhost for older configs.
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.APP_URL ??
  "http://localhost:3000";
const FROM_NAME = process.env.SMTP_FROM_NAME ?? "PoolDN";
const SMTP_USER = process.env.SMTP_USER ?? "";
const SMTP_PASSWORD = process.env.SMTP_PASSWORD ?? "";
const SMTP_HOST = process.env.SMTP_HOST ?? "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 465);
const SMTP_SECURE = (process.env.SMTP_SECURE ?? "true") === "true";

let transporter: Transporter | null = null;
let warned = false;
// Round-45 — boot verification result. We probe the transporter once on
// first use so a misconfigured Gmail App Password fails LOUDLY instead of
// silently dropping every reset email. Set null until probed; once probed
// it stays decided for the process lifetime.
let verifiedOk: boolean | null = null;
let verifyPromise: Promise<boolean> | null = null;

function getTransporter(): Transporter | null {
  if (!SMTP_USER || !SMTP_PASSWORD) {
    if (!warned) {
      console.warn(
        "[email] SMTP_USER / SMTP_PASSWORD not set — outgoing emails are logged, not sent. Use the dev outbox to inspect them.",
      );
      warned = true;
    }
    return null;
  }
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
  return transporter;
}

/**
 * Round-45 — one-shot SMTP credential probe. Called on the first send;
 * the result is cached. If it fails, we log loudly (this is the symptom
 * R45 says was hidden) and subsequent sends still go to the outbox so
 * the dev flow keeps working.
 */
async function ensureVerified(t: Transporter): Promise<boolean> {
  if (verifiedOk !== null) return verifiedOk;
  if (verifyPromise) return verifyPromise;
  verifyPromise = (async () => {
    try {
      await t.verify();
      console.info(
        `[email] SMTP verified — ${SMTP_USER}@${SMTP_HOST}:${SMTP_PORT}`,
      );
      verifiedOk = true;
    } catch (e) {
      console.error(
        `[email] SMTP verify FAILED for ${SMTP_USER}@${SMTP_HOST}:${SMTP_PORT}.`,
        "Gmail requires a 16-char App Password (https://myaccount.google.com/apppasswords).",
        "Falling back to the dev outbox; emails are NOT being delivered.",
        e,
      );
      verifiedOk = false;
    }
    return verifiedOk!;
  })();
  return verifyPromise;
}

// ── Send ────────────────────────────────────────────────────────────────

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  /** Plain-text fallback. Defaults to a stripped version of `html`. */
  text?: string;
};

/**
 * Send an email. Returns `{ ok, messageId? }`. Never throws — failures
 * are logged at error level AND captured in the dev outbox so callers
 * (which fire-and-forget) don't need to special-case mailer flakiness.
 * Throwing here would have meant: silent in prod, exception in dev, both
 * harder to triage than a single capture in the outbox.
 */
export async function send(
  msg: EmailMessage,
): Promise<{ ok: boolean; messageId?: string; note?: string }> {
  const t = getTransporter();
  const fallbackText =
    msg.text ?? msg.html.replace(/<[^>]+>/g, "").replace(/\s+\n/g, "\n").trim();
  const baseEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: fallbackText,
    at: Date.now(),
  };
  if (!t) {
    console.info(
      `[email:DEV] to=${msg.to}\nsubject=${msg.subject}\n${fallbackText}\n`,
    );
    pushOutbox({ ...baseEntry, status: "QUEUED", note: "no-smtp" });
    return { ok: true, note: "no-smtp" };
  }
  // First-use verification. If the creds are bad, log loudly and route
  // every subsequent send through the outbox so dev flows still complete.
  const okCreds = await ensureVerified(t);
  if (!okCreds) {
    pushOutbox({
      ...baseEntry,
      status: "QUEUED",
      note: "smtp-verify-failed",
    });
    return { ok: false, note: "smtp-verify-failed" };
  }
  try {
    const info = await t.sendMail({
      from: `"${FROM_NAME}" <${SMTP_USER}>`,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: fallbackText,
    });
    pushOutbox({ ...baseEntry, status: "SENT" });
    return { ok: true, messageId: info.messageId };
  } catch (e) {
    const message = e instanceof Error ? e.message : "send failed";
    console.error(`[email] send to=${msg.to} failed:`, message);
    pushOutbox({ ...baseEntry, status: "FAILED", note: message });
    return { ok: false, note: message };
  }
}

// ── Templates ───────────────────────────────────────────────────────────

function shell(title: string, body: string, cta?: { href: string; label: string }): string {
  return `<!doctype html>
<html><body style="font-family:system-ui,sans-serif;color:#0a0c08;background:#f3f4f6;padding:24px;margin:0">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e5e7eb">
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#65a30d">${FROM_NAME}</div>
    <h1 style="font-size:20px;margin:12px 0 8px">${title}</h1>
    <div style="font-size:14px;line-height:1.6;color:#374151">${body}</div>
    ${
      cta
        ? `<p style="margin-top:20px"><a href="${cta.href}" style="display:inline-block;background:#84cc16;color:#0a0c08;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:700">${cta.label}</a></p>
       <p style="font-size:12px;color:#6b7280;margin-top:16px">Or paste this URL into your browser:<br><span style="word-break:break-all">${cta.href}</span></p>`
        : ""
    }
    <p style="font-size:11px;color:#9ca3af;margin-top:20px">Sent by PoolDN. If this wasn't you, you can safely ignore this message.</p>
  </div>
</body></html>`;
}

export async function sendEmailVerification(opts: {
  to: string;
  name: string;
  token: string;
}) {
  const href = `${APP_URL}/verify-email?token=${encodeURIComponent(opts.token)}`;
  return send({
    to: opts.to,
    subject: "Confirm your PoolDN email",
    html: shell(
      `Hi ${escapeHtml(opts.name)},`,
      "Tap the button below to confirm this email address on your PoolDN account. The link expires in 24 hours.",
      { href, label: "Verify email" },
    ),
  });
}

export async function sendPasswordReset(opts: {
  to: string;
  name: string;
  token: string;
}) {
  const href = `${APP_URL}/forgot-password?token=${encodeURIComponent(opts.token)}`;
  return send({
    to: opts.to,
    subject: "Reset your PoolDN password",
    html: shell(
      `Hi ${escapeHtml(opts.name)},`,
      "Someone asked to reset your PoolDN password. If that was you, tap the button below within 60 minutes. Otherwise ignore this email.",
      { href, label: "Reset password" },
    ),
  });
}

export async function sendCompetitionInvite(opts: {
  to: string;
  captainName: string;
  teamName: string;
  competitionName: string;
  competitionSlug: string;
  organizerName: string;
  personalNote?: string | null;
}) {
  const href = `${APP_URL}/competitions/${encodeURIComponent(opts.competitionSlug)}`;
  const note = opts.personalNote?.trim()
    ? `<p style="margin:12px 0 0;padding:12px;border-left:3px solid #84cc16;background:#f7fee7;color:#1a2e05;font-style:italic">${escapeHtml(opts.personalNote)}</p>`
    : "";
  return send({
    to: opts.to,
    subject: `You're invited: ${opts.competitionName}`,
    html: shell(
      `Hi ${escapeHtml(opts.captainName)},`,
      `<strong>${escapeHtml(opts.organizerName)}</strong> has invited <strong>${escapeHtml(opts.teamName)}</strong> to compete in <strong>${escapeHtml(opts.competitionName)}</strong>. Open the competition page to review the format, dates and prize pool — then accept or decline.${note}`,
      { href, label: "View competition" },
    ),
  });
}

export async function sendBanNotice(opts: {
  to: string;
  name: string;
  reason: string | null;
}) {
  return send({
    to: opts.to,
    subject: "Your PoolDN account has been suspended",
    html: shell(
      `Hi ${escapeHtml(opts.name)},`,
      `An admin has suspended your PoolDN account.${
        opts.reason
          ? ` Reason: <strong>${escapeHtml(opts.reason)}</strong>.`
          : ""
      } You'll see the lockout screen on your next visit. Reply to this email to appeal.`,
    ),
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
