-- CreateTable
CREATE TABLE "competition_rosters" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competition_rosters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "competition_rosters_competitionId_teamId_idx" ON "competition_rosters"("competitionId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "competition_rosters_competitionId_userId_key" ON "competition_rosters"("competitionId", "userId");

-- AddForeignKey
ALTER TABLE "competition_rosters" ADD CONSTRAINT "competition_rosters_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_rosters" ADD CONSTRAINT "competition_rosters_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_rosters" ADD CONSTRAINT "competition_rosters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
