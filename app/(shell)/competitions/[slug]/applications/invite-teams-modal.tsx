"use client";

import { useMemo, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui-components/react/dialog";
import { useMutation, useQuery } from "@apollo/client/react";
import { Search, UserPlus, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CountryFlag } from "@/components/ui/country-flag";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { TeamsListQuery } from "@/lib/graphql/operations/team.operations";
import { InviteTeamsToCompetitionMutation } from "@/lib/graphql/operations/competition-mutations.operations";

/**
 * Round-49 — batch-invite teams to a competition.
 *
 * Loads the full visible-to-viewer teams list once, filters client-side as
 * the organizer types (the team set is small enough that a server round-trip
 * per keystroke would be wasteful). Already-engaged teams stay visible but
 * are visually tagged and unchecked-by-default.
 */
export function InviteTeamsModal({
  competitionId,
  excludeTeamIds,
  onInvited,
  triggerLabel = "Invite teams",
}: {
  competitionId: string;
  /** Teams with PENDING/APPROVED/WAITLISTED — server skips these, so we
   *  surface that intent in the UI by disabling the checkbox. */
  excludeTeamIds: Set<string>;
  onInvited: () => void;
  /** Round-60 — the Invited section reuses this modal as "Invite More". */
  triggerLabel?: string;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");

  const { data, loading } = useQuery(TeamsListQuery, {
    fetchPolicy: "cache-and-network",
  });
  const [invite, { loading: sending }] = useMutation(
    InviteTeamsToCompetitionMutation,
  );

  const teams = data?.teams ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        t.captain.name.toLowerCase().includes(q) ||
        t.captain.username.toLowerCase().includes(q),
    );
  }, [search, teams]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function reset() {
    setSearch("");
    setSelected(new Set());
    setNote("");
  }

  async function send() {
    const ids = Array.from(selected);
    if (!ids.length) {
      toast.error("Pick at least one team to invite.");
      return;
    }
    try {
      const res = await invite({
        variables: {
          competitionId,
          teamIds: ids,
          personalNote: note.trim() || null,
        },
      });
      const sent = res.data?.inviteTeamsToCompetition?.length ?? 0;
      const skipped = ids.length - sent;
      toast.success(
        sent === 1 ? "1 invite sent" : `${sent} invites sent`,
        skipped > 0
          ? `${skipped} team${skipped > 1 ? "s were" : " was"} already engaged and skipped.`
          : undefined,
      );
      reset();
      setOpen(false);
      onInvited();
    } catch (e) {
      toast.error(
        "Couldn't send invites",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogPrimitive.Trigger
        render={
          <Button variant="primary" size="sm">
            <UserPlus className="size-4" />
            {triggerLabel}
          </Button>
        }
      />
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <DialogPrimitive.Popup
          data-testid="invite-teams-dialog"
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[560px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-border bg-card text-card-foreground shadow-xl outline-none"
        >
          <div className="flex items-start justify-between gap-3 border-b border-border p-5">
            <div>
              <DialogPrimitive.Title className="text-base font-semibold">
                Invite teams
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                Each invited team's captain gets an email + in-app
                notification linking back to this competition.
              </DialogPrimitive.Description>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="border-b border-border p-5 pb-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by team or captain name…"
                className="pl-9"
                data-testid="invite-teams-search"
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {filtered.length} team{filtered.length === 1 ? "" : "s"}
                {search ? ` matching "${search}"` : " visible"}
              </span>
              <span>{selected.size} selected</span>
            </div>
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            {loading && !teams.length ? (
              <li className="py-6 text-center text-sm text-muted-foreground">
                Loading teams…
              </li>
            ) : filtered.length === 0 ? (
              <li className="py-6 text-center text-sm text-muted-foreground">
                No teams match.
              </li>
            ) : (
              filtered.map((team) => {
                const blocked = excludeTeamIds.has(team.id);
                const checked = selected.has(team.id);
                return (
                  <li key={team.id}>
                    <label
                      className={
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm " +
                        (blocked
                          ? "cursor-not-allowed opacity-50"
                          : "cursor-pointer hover:bg-secondary/50")
                      }
                    >
                      <input
                        type="checkbox"
                        className="size-4 rounded border-border"
                        checked={checked}
                        disabled={blocked}
                        onChange={() => toggle(team.id)}
                        data-testid={`invite-team-checkbox-${team.slug}`}
                      />
                      <Avatar
                        size="sm"
                        src={team.logoUrl ?? undefined}
                        fallback={team.name}
                        shape="team"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{team.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          Captain: {team.captain.name}
                          <CountryFlag
                            code={team.captain.nationality}
                            className="ml-1 leading-none"
                          />
                          {team.homeVenue
                            ? ` · ${team.homeVenue.city?.name ?? team.homeVenue.name}`
                            : ""}
                        </div>
                      </div>
                      {blocked ? (
                        <Badge variant="neutral">Already engaged</Badge>
                      ) : null}
                    </label>
                  </li>
                );
              })
            )}
          </ul>

          <div className="border-t border-border p-5">
            <label className="text-xs font-medium text-muted-foreground">
              Personal note (optional — shown in the email + notification)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={400}
              rows={2}
              placeholder="We'd love to have you in this season's bracket."
              className="mt-1 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={sending}
                onClick={send}
                disabled={selected.size === 0}
                data-testid="invite-teams-send"
              >
                Send {selected.size > 0 ? selected.size : ""} invite
                {selected.size === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
