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
        {/* Banner — image if uploaded; otherwise a brand teal→lime gradient
            with a decorative 8-ball mark so the card still reads as PoolDN. */}
        <div
          className="relative h-28 w-full overflow-hidden bg-gradient-to-br from-teal-950 via-teal-900 to-primary/30"
          style={
            c.bannerUrl
              ? {
                  backgroundImage: `linear-gradient(135deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.45) 100%), url('${c.bannerUrl}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
          aria-hidden
        >
          {!c.bannerUrl ? (
            <span
              aria-hidden
              className="absolute -bottom-4 -right-3 inline-flex size-20 items-center justify-center rounded-full bg-primary/20 text-3xl font-black text-primary/80 blur-[1px]"
            >
              8
            </span>
          ) : null}
        </div>
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
