/**
 * Round-45 — in-memory outbox state, deliberately split out from
 * email.service.ts so consumers (admin/outbox page) don't transitively
 * pull `nodemailer` into their RSC bundle. The mailer pushes entries
 * here; readers (the admin page) only need this tiny file.
 */
const OUTBOX_MAX = 50;

export type OutboxEntry = {
  id: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  /** "SENT" | "QUEUED" | "FAILED" — outcome of the actual transport attempt. */
  status: "SENT" | "QUEUED" | "FAILED";
  /** Reason on FAILED, or "no-smtp" on QUEUED. */
  note?: string;
  at: number;
};

const outbox: OutboxEntry[] = [];

export function pushOutbox(entry: OutboxEntry): void {
  outbox.unshift(entry);
  if (outbox.length > OUTBOX_MAX) outbox.length = OUTBOX_MAX;
}

export function getOutbox(): readonly OutboxEntry[] {
  return outbox;
}
