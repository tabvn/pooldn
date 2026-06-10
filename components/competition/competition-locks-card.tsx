"use client";

import { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { useRouter } from "next/navigation";
import { Lock, Unlock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { SetCompetitionLocksMutation } from "@/lib/graphql/operations/competition-mutations.operations";

/**
 * Round-50 — organizer/admin lock toggles. Each switch fires
 * setCompetitionLocks for the matching flag (leaving the other untouched on
 * the server). Optimistic local state keeps the UI snappy; on error we revert.
 */
export function CompetitionLocksCard({
  competitionId,
  registrationLocked,
  rosterLocked,
}: {
  competitionId: string;
  registrationLocked: boolean;
  rosterLocked: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [regLocked, setRegLocked] = useState(registrationLocked);
  const [rosLocked, setRosLocked] = useState(rosterLocked);
  const [busy, setBusy] = useState<null | "reg" | "ros">(null);
  const [setLocks] = useMutation(SetCompetitionLocksMutation);

  async function toggle(kind: "reg" | "ros", next: boolean) {
    const prev = kind === "reg" ? regLocked : rosLocked;
    if (kind === "reg") setRegLocked(next);
    else setRosLocked(next);
    setBusy(kind);
    try {
      await setLocks({
        variables: {
          id: competitionId,
          registrationLocked: kind === "reg" ? next : null,
          rosterLocked: kind === "ros" ? next : null,
        },
      });
      toast.success(
        next ? "Locked" : "Unlocked",
        kind === "reg"
          ? next
            ? "New applications + invites are blocked."
            : "Applications + invites can flow again."
          : next
            ? "Captains can't open roster changes."
            : "Captains can request roster changes again.",
      );
      router.refresh();
    } catch (e) {
      if (kind === "reg") setRegLocked(prev);
      else setRosLocked(prev);
      toast.error(
        "Could not update lock",
        e instanceof Error ? e.message : "Try again.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3" data-testid="competition-locks">
      <LockRow
        title="Lock registration"
        description="Block new team applications and new organizer invites."
        active={regLocked}
        disabled={busy === "reg"}
        onChange={(v) => toggle("reg", v)}
        testId="lock-registration"
      />
      <LockRow
        title="Lock roster edits"
        description="Captains can't propose roster changes while this is on."
        active={rosLocked}
        disabled={busy === "ros"}
        onChange={(v) => toggle("ros", v)}
        testId="lock-roster"
      />
    </div>
  );
}

function LockRow({
  title,
  description,
  active,
  disabled,
  onChange,
  testId,
}: {
  title: string;
  description: string;
  active: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
  testId: string;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-lg border px-4 py-3 transition-colors ${
        active
          ? "border-warning/50 bg-warning/5"
          : "border-border bg-background"
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div
          className={`mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full ${
            active
              ? "bg-warning/20 text-warning"
              : "bg-secondary text-muted-foreground"
          }`}
        >
          {active ? (
            <Lock className="size-4" />
          ) : (
            <Unlock className="size-4" />
          )}
        </div>
        <div className="min-w-0">
          <div className="font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      <Switch
        checked={active}
        disabled={disabled}
        onCheckedChange={onChange}
        data-testid={testId}
        aria-label={title}
      />
    </div>
  );
}
