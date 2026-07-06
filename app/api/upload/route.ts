import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  readSessionCookie,
  verifySessionToken,
} from "@/lib/auth/jwt";
import { defineAbilityFor } from "@/lib/casl/ability";
import {
  put,
  type UploadKind,
} from "@/lib/upload/storage";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

/**
 * Magic-byte sniffer for the formats we accept.
 *
 * The browser-provided `file.type` is a hint from the OS file extension and
 * can lie ("image.jpg" containing an HTML payload, an .exe renamed to .png,
 * a polyglot file). We read the first 12 bytes and confirm the actual file
 * signature — defense against both honest-mistake renames and malicious
 * polyglot uploads.
 *
 *   PNG: 89 50 4E 47 0D 0A 1A 0A
 *   JPG: FF D8 FF
 *   WebP: 'RIFF' (52 49 46 46) + 4 bytes len + 'WEBP' (57 45 42 50)
 */
function sniffImageMime(buf: Buffer): "image/png" | "image/jpeg" | "image/webp" | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return "image/png";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

const VALID_KINDS: ReadonlySet<UploadKind> = new Set([
  "avatar",
  "team-logo",
  "competition-banner",
  "venue-image",
  "score-board",
  "team-logo-draft",
]);

async function loadViewer(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  const authz = req.headers.get("authorization");
  const bearer = authz?.toLowerCase().startsWith("bearer ")
    ? authz.slice(7).trim()
    : null;
  const token = bearer ?? readSessionCookie(cookieHeader);
  if (!token) return null;
  const claims = await verifySessionToken(token);
  if (!claims?.sub) return null;
  return prisma.user.findUnique({ where: { id: claims.sub } });
}

/**
 * Authorize: viewer must own the target entity for the requested kind, or
 * be SUPER_ADMIN.
 */
async function authorize(
  viewer: { id: string; role: string },
  kind: UploadKind,
  ownerId: string,
): Promise<boolean> {
  if (viewer.role === "SUPER_ADMIN") return true;
  switch (kind) {
    case "avatar":
      return viewer.id === ownerId;
    case "team-logo": {
      const t = await prisma.team.findUnique({ where: { id: ownerId } });
      return !!t && t.captainId === viewer.id;
    }
    case "team-logo-draft": {
      // R43 #3 — draft kind lets the create-team wizard upload a logo BEFORE
      // the team exists. Owner is the viewer's user id; createTeam adopts
      // the URL into team.logoUrl on submission.
      return viewer.id === ownerId;
    }
    case "competition-banner": {
      const c = await prisma.competition.findUnique({
        where: { id: ownerId },
      });
      return !!c && c.organizerId === viewer.id;
    }
    case "score-board": {
      // Score-board photos are scoped to a captain — owner-id is the
      // captain's user id; URLs get persisted on submitMatchScore.
      return viewer.id === ownerId;
    }
    case "venue-image": {
      // Venues are organizer/admin-managed; any ORGANIZER can update an
      // existing venue (the CASL Venue.update rule grants this).
      const ability = defineAbilityFor({
        id: viewer.id,
        role: viewer.role as
          | "SUPER_ADMIN"
          | "ORGANIZER"
          | "TEAM_CAPTAIN"
          | "PLAYER"
          | "VIEWER",
      });
      const v = await prisma.venue.findUnique({ where: { id: ownerId } });
      if (!v) return false;
      return ability.can("update", { ...v, __caslSubjectType__: "Venue" });
    }
    default:
      return false;
  }
}

export async function POST(req: Request) {
  const viewer = await loadViewer(req);
  if (!viewer) {
    return NextResponse.json(
      { error: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const kind = String(form.get("kind") ?? "") as UploadKind;
  const ownerId = String(form.get("ownerId") ?? "");
  const file = form.get("file");

  if (!VALID_KINDS.has(kind)) {
    return NextResponse.json(
      { error: `Unknown upload kind: ${kind}` },
      { status: 400 },
    );
  }
  // ownerId becomes part of the on-disk file path. Reject anything that
  // isn't a strict alphanumeric (+ hyphen / underscore) id so path traversal
  // (`..`) and absolute paths (`/etc/...`) are structurally impossible.
  if (!ownerId || !/^[A-Za-z0-9_-]{1,64}$/.test(ownerId)) {
    return NextResponse.json(
      { error: "ownerId must be alphanumeric (1–64 chars)" },
      { status: 400 },
    );
  }
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "file is required" },
      { status: 400 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json(
      { error: "Empty file rejected" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_BYTES} bytes)` },
      { status: 413 },
    );
  }
  // The browser-provided `file.type` is spoofable — verify the real content
  // by sniffing the first 12 bytes against known magic numbers and only
  // accept the actual content type that matches.
  const sniffBuf = Buffer.from(await file.slice(0, 12).arrayBuffer());
  const sniffedMime = sniffImageMime(sniffBuf);
  if (!sniffedMime) {
    return NextResponse.json(
      { error: "File contents do not match a supported image format" },
      { status: 415 },
    );
  }
  // Cross-check with the declared header — if it lies, reject. If it
  // matches, prefer the sniffed value going forward.
  if (file.type && file.type !== sniffedMime && !ALLOWED_MIMES.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported MIME type: ${file.type}` },
      { status: 415 },
    );
  }

  const ok = await authorize(
    { id: viewer.id, role: viewer.role },
    kind,
    ownerId,
  );
  if (!ok) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  // Trust the SNIFFED mime type, not the client-provided one — the latter
  // is already validated above but the actual on-disk extension should
  // reflect what the bytes really are.
  const stored = await put(kind, ownerId, buf, sniffedMime);

  // Best-effort: persist the URL on the owning entity so the next read shows
  // the new image immediately without a separate mutation.
  switch (kind) {
    case "avatar":
      await prisma.user.update({
        where: { id: ownerId },
        data: { avatarUrl: stored.url },
      });
      break;
    case "team-logo":
      await prisma.team.update({
        where: { id: ownerId },
        data: { logoUrl: stored.url },
      });
      break;
    case "competition-banner":
      await prisma.competition.update({
        where: { id: ownerId },
        data: { bannerUrl: stored.url },
      });
      break;
    case "venue-image":
      await prisma.venue.update({
        where: { id: ownerId },
        data: { imageUrl: stored.url },
      });
      break;
  }

  return NextResponse.json(stored);
}
