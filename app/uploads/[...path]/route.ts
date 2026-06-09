import { stat, readFile } from "node:fs/promises";
import { join, resolve, extname } from "node:path";
import { UPLOADS_ROOT } from "@/lib/upload/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const NOT_FOUND = new Response("Not found", { status: 404 });

async function serve(path: string[], includeBody: boolean): Promise<Response> {
  const requested = resolve(join(UPLOADS_ROOT, ...path));
  // Path-traversal guard: the resolved absolute path must still live under
  // UPLOADS_ROOT. Catches `..` segments and absolute paths in the catch-all.
  if (!requested.startsWith(UPLOADS_ROOT + "/") && requested !== UPLOADS_ROOT) {
    return NOT_FOUND;
  }
  const ext = extname(requested).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) return NOT_FOUND;

  let st;
  try {
    st = await stat(requested);
  } catch {
    return NOT_FOUND;
  }
  if (!st.isFile()) return NOT_FOUND;

  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Length": String(st.size),
    "Cache-Control": "public, max-age=31536000, immutable",
    ETag: `"${st.size.toString(16)}-${st.mtimeMs.toString(16)}"`,
    "Last-Modified": new Date(st.mtimeMs).toUTCString(),
  });

  if (!includeBody) return new Response(null, { headers });
  const body = await readFile(requested);
  return new Response(body, { headers });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return serve(path, true);
}

export async function HEAD(
  _req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return serve(path, false);
}
