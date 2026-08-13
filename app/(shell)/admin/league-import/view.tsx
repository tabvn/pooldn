"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { Copy, Plus, Trophy, X } from "lucide-react";
import { DetailHero } from "@/components/layout/detail-hero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  AdminCompetitionsQuery,
  CreateShellPlayersMutation,
  ImportLeagueTeamMutation,
} from "@/lib/graphql/operations/league-import.operations";

type Claim = {
  userId: string;
  name: string;
  username: string;
  claimUrl: string;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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
        <ImportTeamSection />
        <CreatePlayersSection />
      </div>
    </div>
  );
}

function ClaimList({ claims }: { claims: Claim[] }) {
  const toast = useToast();
  if (claims.length === 0) return null;
  return (
    <div className="mt-4 space-y-2 rounded-lg border border-border bg-secondary/20 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Claim links — distribute privately
      </div>
      {claims.map((c) => (
        <div
          key={c.userId}
          className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">
              {c.name}{" "}
              <span className="font-normal text-muted-foreground">
                @{c.username}
              </span>
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {c.claimUrl}
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(c.claimUrl);
              toast.success("Claim link copied");
            }}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label={`Copy claim link for ${c.name}`}
          >
            <Copy className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function CreatePlayersSection() {
  const toast = useToast();
  const [names, setNames] = useState("");
  const [claims, setClaims] = useState<Claim[]>([]);
  const [run, { loading }] = useMutation(CreateShellPlayersMutation);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">Create shell players</h2>
        <p className="text-sm text-muted-foreground">
          Standalone placeholder players (no team). One name per line.
        </p>
      </div>
      <textarea
        value={names}
        onChange={(e) => setNames(e.target.value)}
        rows={5}
        placeholder={"Jane Doe\nJohn Smith"}
        className="block w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <Button
        variant="primary"
        loading={loading}
        onClick={async () => {
          const list = names
            .split("\n")
            .map((n) => n.trim())
            .filter(Boolean);
          if (list.length === 0) {
            toast.error("Add at least one name");
            return;
          }
          try {
            const res = await run({ variables: { input: { names: list } } });
            const created = res.data?.createShellPlayers ?? [];
            setClaims(created);
            setNames("");
            toast.success(`Created ${created.length} shell player(s)`);
          } catch (e) {
            toast.error(
              "Could not create players",
              e instanceof Error ? e.message : undefined,
            );
          }
        }}
      >
        <Plus className="size-4" />
        Create players
      </Button>
      <ClaimList claims={claims} />
    </section>
  );
}

type PlayerRow = { name: string; isCaptain: boolean };

function ImportTeamSection() {
  const toast = useToast();
  const { data } = useQuery(AdminCompetitionsQuery, {
    fetchPolicy: "cache-and-network",
    errorPolicy: "ignore",
  });
  const competitions = useMemo(
    () => data?.competitions ?? [],
    [data?.competitions],
  );

  const [competitionId, setCompetitionId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slug, setSlug] = useState("");
  const [players, setPlayers] = useState<PlayerRow[]>([
    { name: "", isCaptain: true },
  ]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [run, { loading }] = useMutation(ImportLeagueTeamMutation);

  const effectiveSlug = slugTouched ? slug : slugify(teamName);

  function setCaptain(idx: number) {
    setPlayers((ps) => ps.map((p, i) => ({ ...p, isCaptain: i === idx })));
  }
  function patchName(idx: number, name: string) {
    setPlayers((ps) => ps.map((p, i) => (i === idx ? { ...p, name } : p)));
  }
  function addRow() {
    setPlayers((ps) => [...ps, { name: "", isCaptain: ps.length === 0 }]);
  }
  function removeRow(idx: number) {
    setPlayers((ps) => {
      const next = ps.filter((_, i) => i !== idx);
      if (next.length > 0 && !next.some((p) => p.isCaptain)) {
        next[0] = { ...next[0], isCaptain: true };
      }
      return next;
    });
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div>
        <h2 className="text-base font-semibold">Import a team into a competition</h2>
        <p className="text-sm text-muted-foreground">
          Creates a shell team (with a shell captain) and rosters it as an
          approved entry. Mark exactly one player as captain.
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Competition</span>
        <select
          value={competitionId}
          onChange={(e) => setCompetitionId(e.target.value)}
          className="block h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
        >
          <option value="">Select a competition…</option>
          {competitions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.type} · {c.status}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Team name</span>
          <Input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="e.g. Bay City Breakers"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Slug</span>
          <Input
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            placeholder="bay-city-breakers"
          />
        </label>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium">Players</span>
        {players.map((p, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <label className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="radio"
                name="captain"
                checked={p.isCaptain}
                onChange={() => setCaptain(idx)}
              />
              Captain
            </label>
            <Input
              value={p.name}
              onChange={(e) => patchName(idx, e.target.value)}
              placeholder={`Player ${idx + 1} name`}
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => removeRow(idx)}
              aria-label="Remove player"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addRow}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-primary/40 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/5"
        >
          <Plus className="size-4" />
          Add player
        </button>
      </div>

      <Button
        variant="primary"
        loading={loading}
        onClick={async () => {
          const roster = players
            .map((p) => ({ name: p.name.trim(), isCaptain: p.isCaptain }))
            .filter((p) => p.name.length > 0);
          if (!competitionId) return toast.error("Pick a competition");
          if (!teamName.trim()) return toast.error("Team name is required");
          if (roster.length === 0) return toast.error("Add at least one player");
          if (roster.filter((p) => p.isCaptain).length !== 1) {
            return toast.error("Mark exactly one captain");
          }
          try {
            const res = await run({
              variables: {
                input: {
                  competitionId,
                  name: teamName.trim(),
                  slug: effectiveSlug,
                  players: roster,
                },
              },
            });
            const result = res.data?.importLeagueTeam;
            setClaims(result?.claims ?? []);
            toast.success("Team imported");
            setTeamName("");
            setSlug("");
            setSlugTouched(false);
            setPlayers([{ name: "", isCaptain: true }]);
          } catch (e) {
            toast.error(
              "Could not import team",
              e instanceof Error ? e.message : undefined,
            );
          }
        }}
      >
        <Plus className="size-4" />
        Import team
      </Button>
      <ClaimList claims={claims} />
    </section>
  );
}
