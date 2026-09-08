"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui-components/react/dialog";
import { useMutation } from "@apollo/client/react";
import { Copy, Ghost, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { ImportShellTeamForm } from "@/components/admin/shell-forms";
import { AddShellPlayerMutation } from "@/lib/graphql/operations/league-import.operations";
import { errorText } from "@/lib/apollo/error-message";

/**
 * Round-88 — the organizer's placeholder tools, as a dialog that sits next to
 * "Invite" on the Applications tab.
 *
 * Inviting and adding a placeholder answer the same organizer question — "how
 * do I get this person into my competition?" — so they belong in the same row:
 * invite the ones who are on PoolDN, add placeholders for the ones who
 * aren't. The competition runs either way, and the real player takes the
 * placeholder over afterwards (see components/shell/claim-profile-panel.tsx).
 *
 * A claim link is minted with every placeholder and shown ONCE, here — it's the
 * fast hand-off. Anyone who never gets one can still claim from the profile
 * page and have the organizer confirm it.
 */

type Team = { id: string; name: string };

export function AddPlaceholderModal({
  competitionId,
  /** Singles: placeholders enter on their own; team formats need a team. */
  isIndividual,
  /** Teams already entered in this competition. Empty for Singles. */
  teams,
  onCreated,
  triggerLabel = "Add placeholder",
  triggerVariant = "secondary",
}: {
  competitionId: string;
  isIndividual: boolean;
  teams: Team[];
  onCreated?: () => void;
  triggerLabel?: string;
  triggerVariant?: "primary" | "secondary";
}) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"player" | "team">("player");
  // Claim links are shown exactly once, so the list behind the dialog is only
  // refreshed on CLOSE. Refreshing on each add re-renders this subtree and
  // takes the freshly-minted links with it before anyone can copy them.
  const [dirty, setDirty] = useState(false);
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [links, setLinks] = useState<
    Array<{ userId: string; name: string; claimUrl: string }>
  >([]);
  const [addPlayer, { loading }] = useMutation(AddShellPlayerMutation);

  function reset() {
    setName("");
    setTeamId("");
    setLinks([]);
    setMode("player");
  }

  /**
   * Single close path. The header's X sets `open` directly, which does NOT run
   * onOpenChange — so both routes have to come through here or the deferred
   * refresh silently never happens and the new row appears to be missing.
   */
  function close() {
    setOpen(false);
    reset();
    if (dirty) {
      setDirty(false);
      // `onCreated` refetches the client-side query where there is one (the
      // Applications tab). The Players tab and the Singles overview are server
      // components, which cannot pass a callback across the boundary at all —
      // so always refresh the route too, or those two screens keep rendering
      // the roster from before the placeholder was added.
      onCreated?.();
      router.refresh();
    }
  }

  async function submitPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Give the player a name");
      return;
    }
    if (!isIndividual && !teamId) {
      toast.error("Pick the team they play for");
      return;
    }
    try {
      const res = await addPlayer({
        variables: {
          competitionId,
          name: name.trim(),
          teamId: isIndividual ? null : teamId,
        },
      });
      const created = res.data?.addShellPlayer;
      if (created) {
        setLinks((prev) => [created, ...prev]);
        toast.success(
          `${created.name} added`,
          "Copy their claim link now, or let them claim the profile themselves.",
        );
      }
      // Keep the team selection — organizers add placeholders in runs.
      setName("");
      setDirty(true);
    } catch (err) {
      toast.error(
        "Couldn't add that player",
        errorText(err, "Try again."),
      );
    }
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        if (o) setOpen(true);
        else close();
      }}
    >
      <DialogPrimitive.Trigger
        render={
          <Button variant={triggerVariant} size="sm" data-testid="add-placeholder">
            <Ghost className="size-4" />
            {triggerLabel}
          </Button>
        }
      />
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <DialogPrimitive.Popup
          data-testid="add-placeholder-dialog"
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[560px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-border bg-card text-card-foreground shadow-xl outline-none"
        >
          <div className="flex items-start justify-between gap-3 border-b border-border p-5">
            <div>
              <DialogPrimitive.Title className="text-base font-semibold">
                Add a placeholder
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                For people who aren&apos;t on PoolDN yet. Their matches,
                frames and stats all count; when the real player joins they
                claim the profile and everything follows them.
              </DialogPrimitive.Description>
            </div>
            <button
              type="button"
              onClick={close}
              className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          {isIndividual ? null : (
            <div className="flex gap-1 border-b border-border p-5 pb-3">
              {(["player", "team"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setMode(k)}
                  data-active={mode === k || undefined}
                  data-testid={`placeholder-mode-${k}`}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                    mode === k
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary/50",
                  )}
                >
                  {k === "player" ? "Player" : "Whole team"}
                </button>
              ))}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {mode === "player" || isIndividual ? (
              <form
                onSubmit={submitPlayer}
                className="space-y-3"
                data-testid="add-placeholder-player-form"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="placeholder-name">Player name</Label>
                  <Input
                    id="placeholder-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Nguyen Van A"
                  />
                </div>
                {isIndividual ? (
                  <p className="text-xs text-muted-foreground">
                    They enter as a confirmed player in this Singles
                    competition.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="placeholder-team">Team</Label>
                    <select
                      id="placeholder-team"
                      value={teamId}
                      onChange={(e) => setTeamId(e.target.value)}
                      className="block h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                    >
                      <option value="">Select a team…</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    {teams.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No teams entered yet — add a whole placeholder team
                        first, or approve a team&apos;s entry.
                      </p>
                    ) : null}
                  </div>
                )}
                <Button type="submit" size="sm" loading={loading}>
                  <Plus className="size-4" />
                  Add player
                </Button>
              </form>
            ) : (
              // The team form owns its own submit + claim-link list.
              <ImportShellTeamForm
                competitionId={competitionId}
                onCreated={() => setDirty(true)}
              />
            )}

            {links.length > 0 ? (
              <div className="mt-4 space-y-2 rounded-xl border border-border bg-secondary/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Claim links — shown once, share privately
                </div>
                {links.map((l) => (
                  <div
                    key={l.userId}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        {l.name}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {l.claimUrl}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(l.claimUrl);
                        toast.success("Claim link copied");
                      }}
                      aria-label={`Copy claim link for ${l.name}`}
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <Copy className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
