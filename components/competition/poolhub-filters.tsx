"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  CompetitionStatus,
  GameType,
} from "@/lib/generated/prisma/enums";

/**
 * Round-34 — the City filter was removed from the competitions browse: the
 * header's city selector already governs scope, so duplicating it here was
 * redundant + confusing. Filters left here: search / status / game type.
 *
 * Cities are still passed in (for legacy callers / future filters) but the
 * dropdown is hidden.
 */

const STATUS_OPTIONS = [
  { value: "", label: "Any status" },
  { value: CompetitionStatus.OPEN_FOR_APPLICATIONS, label: "Open" },
  { value: CompetitionStatus.APPLICATIONS_CLOSED, label: "Applications closed" },
  { value: CompetitionStatus.ONGOING, label: "Ongoing" },
  { value: CompetitionStatus.COMPLETED, label: "Completed" },
] as const;

const GAME_TYPE_OPTIONS = [
  { value: "", label: "Any game" },
  { value: GameType.EIGHT_BALL, label: "8-ball" },
  { value: GameType.NINE_BALL, label: "9-ball" },
  { value: GameType.TEN_BALL, label: "10-ball" },
  { value: GameType.STRAIGHT_POOL, label: "Straight pool" },
] as const;

type City = { id: string; name: string };

export function PoolhubFilters({ cities: _cities }: { cities: City[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  }

  const status = searchParams.get("status") ?? "";
  const gameType = searchParams.get("gameType") ?? "";
  const search = searchParams.get("search") ?? "";

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Input
        placeholder="Search by name or slug"
        defaultValue={search}
        onChange={(e) => set("search", e.target.value)}
        data-testid="filter-search"
      />
      <Select
        value={status}
        onValueChange={(v) => set("status", v)}
        options={[...STATUS_OPTIONS]}
      />
      <Select
        value={gameType}
        onValueChange={(v) => set("gameType", v)}
        options={[...GAME_TYPE_OPTIONS]}
      />
    </div>
  );
}
