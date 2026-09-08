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
import { UsersDirectoryQuery } from "@/lib/graphql/operations/team-mutations.operations";
import { InvitePlayersToCompetitionMutation } from "@/lib/graphql/operations/competition-mutations.operations";
import { errorText } from "@/lib/apollo/error-message";

/**
 * Round-76 — batch-invite players to a Singles (INDIVIDUAL) competition.
 *
 * The solo mirror of InviteTeamsModal: a Singles league has no teams and no
 * captains, so the picker lists players and the mutation writes applications
 * keyed on applicantUserId. Same shape otherwise — load the directory once,
 * filter client-side, and disable anyone already engaged.
 */
export function InvitePlayersModal({
  competitionId,
  excludeUserIds,
  onInvited,
  triggerLabel = "Invite players",
}: {
  competitionId: string;
  /** Players with PENDING/APPROVED/WAITLISTED — the server skips these, so
   *  the checkbox is disabled to surface that up-front. */
  excludeUserIds: Set<string>;
  onInvited: () => void;
  /** The Invited section reuses this modal as "Invite More". */
  triggerLabel?: string;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");

  const { data, loading } = useQuery(UsersDirectoryQuery, {
    fetchPolicy: "cache-and-network",
  });
  const [invite, { loading: sending }] = useMutation(
    InvitePlayersToCompetitionMutation,
  );

  const players = data?.users ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return players;
    return players.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.username.toLowerCase().includes(q),
    );
  }, [search, players]);

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
      toast.error("Pick at least one player to invite.");
      return;
    }
    try {
      const res = await invite({
        variables: {
          competitionId,
          userIds: ids,
          personalNote: note.trim() || null,
        },
      });
      const sent = res.data?.invitePlayersToCompetition?.length ?? 0;
      const skipped = ids.length - sent;
      toast.success(
        sent === 1 ? "1 invite sent" : `${sent} invites sent`,
        skipped > 0
          ? `${skipped} player${skipped > 1 ? "s were" : " was"} already entered and skipped.`
          : undefined,
      );
      reset();
      setOpen(false);
      onInvited();
    } catch (e) {
      toast.error(
        "Couldn't send invites",
        errorText(e, "Try again."),
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
          data-testid="invite-players-dialog"
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[560px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-border bg-card text-card-foreground shadow-xl outline-none"
        >
          <div className="flex items-start justify-between gap-3 border-b border-border p-5">
            <div>
              <DialogPrimitive.Title className="text-base font-semibold">
                Invite players
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                Each invited player gets an email + in-app notification
                linking back to this competition.
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
                placeholder="Search by player name or username…"
                className="pl-9"
                data-testid="invite-players-search"
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {filtered.length} player{filtered.length === 1 ? "" : "s"}
                {search ? ` matching "${search}"` : " visible"}
              </span>
              <span>{selected.size} selected</span>
            </div>
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            {loading && !players.length ? (
              <li className="py-6 text-center text-sm text-muted-foreground">
                Loading players…
              </li>
            ) : filtered.length === 0 ? (
              <li className="py-6 text-center text-sm text-muted-foreground">
                No players match.
              </li>
            ) : (
              filtered.map((player) => {
                const blocked = excludeUserIds.has(player.id);
                const checked = selected.has(player.id);
                return (
                  <li key={player.id}>
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
                        onChange={() => toggle(player.id)}
                        data-testid={`invite-player-checkbox-${player.username}`}
                      />
                      <Avatar
                        size="sm"
                        src={player.avatarUrl ?? undefined}
                        fallback={player.name}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">
                          {player.name}
                          <CountryFlag
                            code={player.nationality}
                            className="ml-1 leading-none"
                          />
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          @{player.username}
                        </div>
                      </div>
                      {blocked ? (
                        <Badge variant="neutral">Already entered</Badge>
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
              placeholder="We'd love to have you in this season's line-up."
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
                data-testid="invite-players-send"
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
