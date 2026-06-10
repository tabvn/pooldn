"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import {
  Bell,
  ClipboardCheck,
  MessagesSquare,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import {
  MyNotificationPreferencesQuery,
  SetNotificationPreferenceMutation,
} from "@/lib/graphql/operations/notification-preferences.operations";

/**
 * Round-50 — simplified notification settings.
 *
 * The earlier version exposed a matrix of (category × channel) toggles
 * (in-app / email / weekly digest). It was over-built: most people just
 * want to say "yes, tell me" or "no, don't" for a given kind of activity.
 *
 * Now: ONE switch per category. Toggling it flips the IN_APP channel for
 * every notification type inside that category. The notification service
 * checks IN_APP before creating any row, so OFF means the user truly stops
 * receiving that kind of update.
 *
 * Email + weekly-digest schemas + channels stay in the DB so we don't have
 * to ship a migration; they're just no longer surfaced in the UI.
 */

type Category = {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  types: string[];
};

const CATEGORIES: Category[] = [
  {
    key: "matches",
    label: "Matches",
    description: "Scheduled matches, score recorded, conflicts, walkovers.",
    icon: <Trophy className="size-4" />,
    types: ["MATCH_SCHEDULED", "MATCH_RESULT_RECORDED"],
  },
  {
    key: "competitions",
    label: "Competitions",
    description:
      "Application status (submitted, approved, rejected, waitlisted), " +
      "competition start / completion, organizer invites.",
    icon: <ClipboardCheck className="size-4" />,
    types: [
      "APPLICATION_SUBMITTED",
      "APPLICATION_APPROVED",
      "APPLICATION_REJECTED",
      "APPLICATION_WAITLISTED",
      "COMPETITION_STARTED",
      "COMPETITION_COMPLETED",
      "COMPETITION_INVITE",
    ],
  },
  {
    key: "roster",
    label: "Roster",
    description:
      "Team invites and per-competition Roster Captain assignments.",
    icon: <Sparkles className="size-4" />,
    types: ["ROSTER_INVITE", "ROSTER_CAPTAIN_ASSIGNED"],
  },
  {
    key: "community",
    label: "Community",
    description:
      "Likes, comments, replies, mentions, and quotes on your posts.",
    icon: <MessagesSquare className="size-4" />,
    types: [
      "COMMUNITY_LIKE",
      "COMMUNITY_COMMENT",
      "COMMUNITY_REPLY",
      "COMMUNITY_MENTION",
      "COMMUNITY_QUOTE",
    ],
  },
  {
    key: "system",
    label: "System",
    description: "Welcome message + system announcements from PoolDN.",
    icon: <Bell className="size-4" />,
    types: ["WELCOME"],
  },
];

const IN_APP_DEFAULT = true;

export function NotificationsTab() {
  const toast = useToast();
  const { data, refetch } = useQuery(MyNotificationPreferencesQuery, {
    fetchPolicy: "cache-and-network",
  });
  const [save] = useMutation(SetNotificationPreferenceMutation);

  const rows = data?.myNotificationPreferences ?? [];
  function enabled(type: string): boolean {
    const found = rows.find((r) => r.type === type && r.channel === "IN_APP");
    return found ? found.isEnabled : IN_APP_DEFAULT;
  }

  function categoryState(types: string[]): "on" | "off" | "mixed" {
    const flags = types.map(enabled);
    if (flags.every((v) => v)) return "on";
    if (flags.every((v) => !v)) return "off";
    return "mixed";
  }

  async function toggleCategory(category: Category, next: boolean) {
    try {
      // Fan out in parallel so the row UI updates as quickly as the
      // round-trips allow. Each call invalidates the per-user cache on the
      // server; the refetch below pulls the fresh full state.
      await Promise.all(
        category.types.map((t) =>
          save({
            variables: { type: t, channel: "IN_APP", isEnabled: next },
          }),
        ),
      );
      await refetch();
    } catch (e) {
      toast.error("Could not save preference", e);
    }
  }

  return (
    <div className="max-w-2xl space-y-3">
      <Card>
        <CardContent className="space-y-1 p-2">
          {CATEGORIES.map((cat) => {
            const state = categoryState(cat.types);
            const isOn = state === "on";
            const isMixed = state === "mixed";
            return (
              <label
                key={cat.key}
                className="flex cursor-pointer items-start justify-between gap-4 rounded-md px-3 py-3 transition-colors hover:bg-secondary/30"
                data-testid={`notif-category-${cat.key}`}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span
                    aria-hidden
                    className={
                      "mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full " +
                      (isOn || isMixed
                        ? "bg-primary/15 text-primary"
                        : "bg-secondary text-muted-foreground")
                    }
                  >
                    {cat.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{cat.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {cat.description}
                    </div>
                  </div>
                </div>
                <Switch
                  checked={isOn || isMixed}
                  onCheckedChange={(next) => toggleCategory(cat, next)}
                  aria-label={cat.label}
                  data-testid={`notif-toggle-${cat.key}`}
                />
              </label>
            );
          })}
        </CardContent>
      </Card>
      <p className="px-2 text-xs text-muted-foreground">
        Each switch controls in-app notifications (the bell icon) for that
        category. Turn one off to stop getting those updates.
      </p>
    </div>
  );
}
