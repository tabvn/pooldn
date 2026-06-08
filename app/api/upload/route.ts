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

const VALID_KINDS: ReadonlySet<UploadKind> = new Set([
  "avatar",
  "team-logo",
  "competition-banner",
  "venue-image",
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
    case "competition-banner": {
      const c = await prisma.competition.findUnique({
        where: { id: ownerId },
      });
      return !!c && c.organizerId === viewer.id;
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
  if (!ownerId) {
    return NextResponse.json(
      { error: "ownerId is required" },
      { status: 400 },
    );
  }
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "file is required" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_BYTES} bytes)` },
      { status: 413 },
    );
  }
  if (!ALLOWED_MIMES.has(file.type)) {
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
  const stored = await put(kind, ownerId, buf, file.type);

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
