import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompetitionStatusChip } from "@/components/ui/status-chip";
import { MetaChips, type MetaChipsCompetition } from "./meta-chips";

export type CompetitionCardData = MetaChipsCompetition & {
  id: string;
  slug: string;
  name: string;
  bannerUrl?: string | null;
};

export function CompetitionCard({ c }: { c: CompetitionCardData }) {
  return (
    <Link
      href={`/competitions/${c.slug}`}
      data-testid={`competition-card-${c.slug}`}
    >
      <Card className="overflow-hidden hover:border-primary/50 transition-colors">
        {/* Banner — image if uploaded, otherwise a lime gradient stripe so the
            card still has visual hierarchy. */}
        <div
          className="relative h-28 w-full bg-gradient-to-br from-primary/30 via-primary/10 to-secondary/40"
          style={
            c.bannerUrl
              ? {
                  backgroundImage: `url('${c.bannerUrl}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
          aria-hidden
        />
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CompetitionStatusChip status={c.status} />
          </div>
          <CardTitle className="text-primary">{c.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <MetaChips c={c} showStatus={false} showCapacity={false} />
        </CardContent>
      </Card>
    </Link>
  );
}
