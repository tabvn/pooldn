-- Round-69 — board/scoresheet proof attached at organizer/admin result confirmation.
ALTER TABLE "matches" ADD COLUMN "resultProofImageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
