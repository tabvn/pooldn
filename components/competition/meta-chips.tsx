import { Calendar, MapPin, Trophy, Users } from "lucide-react";
import { IconChip } from "@/components/ui/icon-chip";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { CompetitionStatusChip } from "@/components/ui/status-chip";
import type {
  CompetitionFormat,
  CompetitionStatus,
  GameType,
} from "@/lib/generated/prisma/enums";

export type MetaChipsCompetition = {
  status: CompetitionStatus;
  format: CompetitionFormat;
  gameType: GameType;
  startDate?: string | null;
  endDate?: string | null;
  prizePool?: string | null;
  currency?: string;
  minTeams?: number;
  maxTeams?: number | null;
  city?: { name: string } | null;
};

// Numbers use an explicit "en-US" locale so the SSR / hydration output
// matches no matter what locale the browser advertises. Dates render in the
// viewer's local TZ via LocalDateTime (client component).
const NUM = new Intl.NumberFormat("en-US");

export function MetaChips({
  c,
  showStatus = true,
  showCapacity = true,
}: {
  c: MetaChipsCompetition;
  showStatus?: boolean;
  showCapacity?: boolean;
}) {
  return (
    <>
      {showStatus ? <CompetitionStatusChip status={c.status} /> : null}
      <IconChip
        tone="primary"
        icon={<Trophy />}
        label={`${c.format.replace(/_/g, " ").toLowerCase()} · ${c.gameType.replace("_", "-").toLowerCase()}`}
      />
      {c.startDate ? (
        <IconChip
          tone="neutral"
          icon={<Calendar />}
          label={
            <>
              <LocalDateTime value={c.startDate} variant="date" />
              {c.endDate ? (
                <>
                  {" – "}
                  <LocalDateTime value={c.endDate} variant="date" />
                </>
              ) : null}
            </>
          }
        />
      ) : null}
      {c.city ? (
        <IconChip tone="neutral" icon={<MapPin />} label={c.city.name} />
      ) : null}
      {showCapacity && c.minTeams != null ? (
        <IconChip
          tone="neutral"
          icon={<Users />}
          label={`${c.minTeams}${c.maxTeams ? `–${c.maxTeams}` : "+"} teams`}
        />
      ) : null}
      {c.prizePool ? (
        <IconChip
          tone="success"
          icon={<Trophy />}
          label={`${NUM.format(Number(c.prizePool))} ${c.currency ?? ""}`.trim()}
        />
      ) : null}
    </>
  );
}
