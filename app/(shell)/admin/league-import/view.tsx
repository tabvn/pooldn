"use client";

import { Trophy } from "lucide-react";
import { DetailHero } from "@/components/layout/detail-hero";
import {
  CreateShellPlayersForm,
  ImportShellTeamForm,
} from "@/components/admin/shell-forms";

/**
 * Round-75 — seed an imported offline league with claimable shell players and
 * teams. Round-87 — the two forms moved to components/admin/shell-forms so the
 * Shells screen can offer the same "New shell player / team" actions without a
 * second copy.
 */
export function LeagueImportView() {
  return (
    <div className="flex flex-col">
      <DetailHero
        title="League Import"
        meta={
          <span className="inline-flex items-center gap-2">
            <Trophy className="size-3.5" /> Admin · shell players &amp; teams
          </span>
        }
      />
      <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 md:px-10 md:py-8">
        <p className="text-sm text-muted-foreground">
          Seed an imported offline league with placeholder (&quot;shell&quot;)
          players and teams. Distribute each claim link privately to the real
          person — they take over the profile (and all its history) at that link.
          Enter the season&apos;s matches afterward through the normal match flow.
        </p>
        <ImportShellTeamForm />
        <CreateShellPlayersForm />
      </div>
    </div>
  );
}
