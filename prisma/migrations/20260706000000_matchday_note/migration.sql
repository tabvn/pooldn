-- Round-64 — organizer note when a matchday is moved (holiday / clash).
ALTER TABLE "matchdays" ADD COLUMN IF NOT EXISTS "note" TEXT;
