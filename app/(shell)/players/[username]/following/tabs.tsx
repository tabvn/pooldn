"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Users, Building2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { FollowingList } from "@/components/following-list";
import { FollowedTeamsList } from "@/components/followed-teams-list";
import { FollowedCompetitionsList } from "@/components/followed-competitions-list";

type Tab = "players" | "teams" | "competitions";

/**
 * Round-50 — local-state tabs for the public Following page. URL is kept in
 * sync via ?tab= so a deep-link to a specific tab is shareable; replaceState
 * keeps the back stack clean.
 */
export function FollowingTabs({
  userId,
  initialTab,
  counts,
}: {
  userId: string;
  initialTab: Tab;
  counts: { players: number; teams: number; competitions: number };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(initialTab);

  function setActive(next: Tab) {
    if (next === tab) return;
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Following category"
        className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/40 p-1"
      >
        <TabButton
          active={tab === "players"}
          onClick={() => setActive("players")}
          icon={<Users className="size-3.5" />}
          label="Players"
          count={counts.players}
          testId="tab-players"
        />
        <TabButton
          active={tab === "teams"}
          onClick={() => setActive("teams")}
          icon={<Building2 className="size-3.5" />}
          label="Teams"
          count={counts.teams}
          testId="tab-teams"
        />
        <TabButton
          active={tab === "competitions"}
          onClick={() => setActive("competitions")}
          icon={<Trophy className="size-3.5" />}
          label="Competitions"
          count={counts.competitions}
          testId="tab-competitions"
        />
      </div>

      {tab === "players" ? <FollowingList userId={userId} /> : null}
      {tab === "teams" ? <FollowedTeamsList userId={userId} /> : null}
      {tab === "competitions" ? (
        <FollowedCompetitionsList userId={userId} />
      ) : null}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-colors",
        active
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
      <span
        className={cn(
          "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none",
          active
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}
