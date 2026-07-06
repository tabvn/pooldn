import { mkdir, writeFile, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

/**
 * Tiny filesystem-backed storage abstraction. The shape mirrors what an S3/R2
 * client looks like (`put`, `delete`, `publicUrl`) so swapping the dev impl
 * for object storage later is a drop-in.
 *
 * Files live OUTSIDE `public/` because Next.js's production server snapshots
 * the public folder at startup — anything written after `next start` would
 * 404. We serve uploads through a tiny route handler at `app/uploads/...`
 * instead.
 */
export const UPLOADS_PUBLIC_PREFIX = "/uploads";
export const UPLOADS_ROOT = join(process.cwd(), "uploads");

export type UploadKind =
  | "avatar"
  | "team-logo"
  | "team-logo-draft"
  | "competition-banner"
  | "venue-image"
  | "score-board";

/**
 * Multi-instance kinds where a single owner produces many files (e.g. a
 * user dropping several images into a post). Each upload lands at
 *   public/uploads/{kind}/{ownerId}/{random}.{ext}
 * and lives independently — deletes remove only that one URL.
 */
export const MULTI_KINDS: ReadonlySet<UploadKind> = new Set([
  "score-board",
  "team-logo-draft",
]);

export type StoredFile = {
  /** Public URL that the browser can use directly. */
  url: string;
  /** Bytes written. */
  size: number;
  /** MIME type as recorded. */
  contentType: string;
};

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

export function extForMime(mime: string): string | null {
  return EXT_BY_MIME[mime.toLowerCase()] ?? null;
}

/**
 * Deterministic per-entity path:
 *   public/uploads/{kind}/{ownerId}.{ext}
 *
 * One owner → one file. A re-upload overwrites the previous one so we never
 * accumulate duplicates. The owner id is a cuid (non-guessable), so leaking
 * the slug or username doesn't reveal the URL.
 */
export function objectPath(kind: UploadKind, ownerId: string, ext: string) {
  return join(UPLOADS_ROOT, kind, `${ownerId}.${ext}`);
}

export function publicUrl(kind: UploadKind, ownerId: string, ext: string) {
  // Append a cache-buster (mtime) so the browser drops the old cached image
  // immediately after a re-upload.
  return `${UPLOADS_PUBLIC_PREFIX}/${kind}/${ownerId}.${ext}?v=${Date.now()}`;
}

export async function put(
  kind: UploadKind,
  ownerId: string,
  buf: Buffer,
  contentType: string,
): Promise<StoredFile> {
  const ext = extForMime(contentType);
  if (!ext) throw new Error(`Unsupported content type: ${contentType}`);
  if (MULTI_KINDS.has(kind)) {
    const id = randomUUID();
    const path = join(UPLOADS_ROOT, kind, ownerId, `${id}.${ext}`);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buf);
    return {
      url: `${UPLOADS_PUBLIC_PREFIX}/${kind}/${ownerId}/${id}.${ext}`,
      size: buf.byteLength,
      contentType,
    };
  }
  const path = objectPath(kind, ownerId, ext);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buf);
  // Best-effort: nuke siblings with a different extension so the same owner
  // can't keep one of each (avatar.png + avatar.jpg) after switching.
  for (const otherExt of Object.values(EXT_BY_MIME)) {
    if (otherExt === ext) continue;
    await unlink(objectPath(kind, ownerId, otherExt)).catch(() => {});
  }
  return {
    url: publicUrl(kind, ownerId, ext),
    size: buf.byteLength,
    contentType,
  };
}

export async function remove(kind: UploadKind, ownerId: string) {
  for (const ext of Object.values(EXT_BY_MIME)) {
    await unlink(objectPath(kind, ownerId, ext)).catch(() => {});
  }
}
