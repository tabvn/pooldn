-- Round-75 — "shell" (placeholder) accounts for importing an offline league.
-- A shell has synthetic credentials and cannot sign in / be notified until a
-- real person claims it (which upgrades the row in place). See User.isShell.
ALTER TABLE "users" ADD COLUMN "isShell" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "claimedAt" TIMESTAMP(3);

CREATE INDEX "users_isShell_idx" ON "users"("isShell");
