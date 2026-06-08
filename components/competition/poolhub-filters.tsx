"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  CompetitionStatus,
  GameType,
} from "@/lib/generated/prisma/enums";

type City = { id: string; name: string };

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

export function PoolhubFilters({ cities }: { cities: City[] }) {
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
  const cityId = searchParams.get("cityId") ?? "";
  const gameType = searchParams.get("gameType") ?? "";
  const search = searchParams.get("search") ?? "";

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
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
      <Select
        value={cityId}
        onValueChange={(v) => set("cityId", v)}
        options={[
          { value: "", label: "Any city" },
          ...cities.map((c) => ({ value: c.id, label: c.name })),
        ]}
      />
    </div>
  );
}
