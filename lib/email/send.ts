/**
 * Email send abstraction.
 *
 * Two backends:
 *   - Resend (https://resend.com) when RESEND_API_KEY is set. Sends real
 *     transactional email via their REST API.
 *   - Console-log fallback otherwise. Keeps local dev + CI happy without
 *     leaking keys; the email body shows up in the server log so you can
 *     paste-and-preview.
 *
 * Single helper so every notification surface (welcome, digest, password
 * reset) goes through the same audit point.
 */

export type EmailSendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

const FROM = process.env.EMAIL_FROM ?? "PoolDN <no-reply@pooldn.app>";
const RESEND_KEY = process.env.RESEND_API_KEY;

export async function sendEmail(args: EmailSendArgs): Promise<{
  ok: boolean;
  id?: string;
  error?: string;
}> {
  if (!RESEND_KEY) {
    // Dev / preview / CI — log to stdout. Useful as a paste-into-browser
    // preview when iterating on templates.
    console.log("[email:stub]", {
      from: FROM,
      to: args.to,
      subject: args.subject,
      html: args.html.length > 200
        ? args.html.slice(0, 200) + "…"
        : args.html,
    });
    return { ok: true, id: "stub" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
        reply_to: args.replyTo,
      }),
    });
    if (!res.ok) {
      const error = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${error}` };
    }
    const json = (await res.json()) as { id?: string };
    return { ok: true, id: json.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
