import { prisma } from "@/lib/prisma";
import { recomputeMvp } from "@/lib/services/standings.service";

async function main() {
  const comps = await prisma.competition.findMany({ select: { id: true, slug: true } });
  for (const c of comps) {
    await recomputeMvp(prisma, c.id);
  }
  console.log(`Recomputed player stats for ${comps.length} competitions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
