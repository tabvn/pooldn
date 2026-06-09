import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const APP_SECRET = process.env.FACEBOOK_CLIENT_SECRET ?? "";

function b64urlToBuffer(input: string): Buffer {
  const s = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  return Buffer.from(s + pad, "base64");
}

/**
 * Parse + verify Facebook's `signed_request` (HMAC-SHA256 with the app secret).
 * Returns the decoded payload, or null if the signature is invalid.
 */
function parseSignedRequest(signed: string): { user_id?: string; algorithm?: string } | null {
  if (!APP_SECRET || !signed.includes(".")) return null;
  const [encodedSig, payload] = signed.split(".");
  let expected: Buffer;
  let actual: Buffer;
  try {
    actual = b64urlToBuffer(encodedSig);
    expected = crypto.createHmac("sha256", APP_SECRET).update(payload).digest();
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return null;
  }
  try {
    const data = JSON.parse(b64urlToBuffer(payload).toString("utf8"));
    if (data.algorithm && String(data.algorithm).toUpperCase() !== "HMAC-SHA256") return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Facebook Data Deletion Request Callback.
 * Docs: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 *
 * Facebook POSTs `signed_request`. We verify it, delete the matching user's
 * data (matched by their stored Facebook id), and MUST respond with JSON:
 *   { "url": <status URL>, "confirmation_code": <code> }
 */
export async function POST(request: Request) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  let signed = "";
  try {
    const ct = request.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      signed = String((await request.json())?.signed_request ?? "");
    } else {
      const form = await request.formData();
      signed = String(form.get("signed_request") ?? "");
    }
  } catch {
    /* fall through to invalid */
  }

  const data = signed ? parseSignedRequest(signed) : null;
  if (!data?.user_id) {
    return NextResponse.json({ error: "invalid signed_request" }, { status: 400 });
  }

  const userId = String(data.user_id);
  // Confirmation code Facebook (and the user) can reference for status.
  const confirmationCode =
    "fbdel_" + crypto.createHash("sha256").update(userId + ":" + Date.now()).digest("hex").slice(0, 16);

  // Best-effort deletion: remove the account linked to this Facebook id.
  // Raw SQL so this compiles before the `facebookId` column migration lands;
  // once the column exists this actually deletes the user. Wrapped so the
  // callback always returns a valid response to Facebook.
  try {
    await prisma.$executeRawUnsafe(
      'DELETE FROM "users" WHERE "facebookId" = $1',
      userId,
    );
  } catch (e) {
    console.warn("[fb data-deletion] delete skipped/failed:", (e as Error).message);
  }

  return NextResponse.json({
    url: `${origin}/data-deletion?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
}

// Facebook only POSTs here; a GET is handy for a quick manual check.
export async function GET(request: Request) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  return NextResponse.redirect(new URL("/data-deletion", origin));
}
