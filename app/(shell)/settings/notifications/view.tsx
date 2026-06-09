"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import {
  MyNotificationPreferencesQuery,
  SetNotificationPreferenceMutation,
} from "@/lib/graphql/operations/notification-preferences.operations";

type Channel = "IN_APP" | "EMAIL" | "DIGEST";

/**
 * Round-33 — viewer-facing notification controls.
 *
 * Defaults (when no row exists):
 *   IN_APP   ON   (you'll see bell badges)
 *   DIGEST   ON   (Sunday recap email)
 *   EMAIL    OFF  (per-event transactional email — opt in only)
 *
 * The categories below are grouped by domain so a captain can mute
 * community noise without muting their roster invites.
 */
const CATEGORIES: Array<{
  key: string;
  label: string;
  description: string;
  types: string[];
}> = [
  {
    key: "matches",
    label: "Matches & results",
    description:
      "Scheduled matches, result recorded, score conflicts, walkovers.",
    types: ["MATCH_SCHEDULED", "MATCH_RESULT_RECORDED"],
  },
  {
    key: "competitions",
    label: "Competitions",
    description: "Application status, competition lifecycle.",
    types: [
      "APPLICATION_SUBMITTED",
      "APPLICATION_APPROVED",
      "APPLICATION_REJECTED",
      "APPLICATION_WAITLISTED",
      "COMPETITION_STARTED",
      "COMPETITION_COMPLETED",
    ],
  },
  {
    key: "roster",
    label: "Roster",
    description: "Invites to join a team.",
    types: ["ROSTER_INVITE"],
  },
  {
    key: "community",
    label: "Community",
    description: "Likes, comments, replies, mentions, quotes on your posts.",
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
    description: "Welcome, system announcements.",
    types: ["WELCOME"],
  },
];

const CHANNELS: Array<{ key: Channel; label: string; help: string }> = [
  { key: "IN_APP", label: "Bell", help: "In-app notification badge + inbox row." },
  { key: "EMAIL", label: "Email", help: "Per-event email. Off by default." },
  {
    key: "DIGEST",
    label: "Weekly digest",
    help: "Sunday recap email of activity in the past week.",
  },
];

const DEFAULTS: Record<Channel, boolean> = {
  IN_APP: true,
  EMAIL: false,
  DIGEST: true,
};

export function NotificationsTab() {
  const toast = useToast();
  const { data, refetch } = useQuery(MyNotificationPreferencesQuery, {
    fetchPolicy: "cache-and-network",
  });
  const [save] = useMutation(SetNotificationPreferenceMutation);

  // Build a map: type → channel → enabled, applying defaults.
  const rows = data?.myNotificationPreferences ?? [];
  function enabled(type: string, channel: Channel): boolean {
    const found = rows.find((r) => r.type === type && r.channel === channel);
    return found ? found.isEnabled : DEFAULTS[channel];
  }

  async function toggle(type: string, channel: Channel, next: boolean) {
    try {
      await save({
        variables: { type, channel, isEnabled: next },
      });
      await refetch();
    } catch (e) {
      toast.error("Could not save preference", e);
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Channels</CardTitle>
          <p className="text-xs text-muted-foreground">
            Choose where you want each kind of notification to land. You can
            mute one category without muting the rest.
          </p>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="hidden grid-cols-[1fr_repeat(3,80px)] gap-3 px-1 pb-2 text-xs uppercase tracking-wider text-muted-foreground md:grid">
            <span>Category</span>
            {CHANNELS.map((c) => (
              <span
                key={c.key}
                className="text-center"
                title={c.help}
              >
                {c.label}
              </span>
            ))}
          </div>
          {CATEGORIES.map((cat) => (
            <div
              key={cat.key}
              className="grid grid-cols-1 gap-3 rounded-md border border-border bg-background px-3 py-3 md:grid-cols-[1fr_repeat(3,80px)] md:items-center"
              data-testid={`notif-category-${cat.key}`}
            >
              <div>
                <div className="text-sm font-semibold">{cat.label}</div>
                <div className="text-xs text-muted-foreground">
                  {cat.description}
                </div>
              </div>
              {CHANNELS.map((ch) => {
                // We apply the toggle to every type inside the category in
                // parallel — keeps the UI from exposing 14 different rows.
                const isOn = cat.types.every((t) => enabled(t, ch.key));
                const isMixed =
                  !isOn && cat.types.some((t) => enabled(t, ch.key));
                return (
                  <div
                    key={ch.key}
                    className="flex items-center justify-between md:justify-center"
                  >
                    <span className="text-xs uppercase tracking-wider text-muted-foreground md:hidden">
                      {ch.label}
                    </span>
                    <Switch
                      checked={isOn || isMixed}
                      onCheckedChange={async (next) => {
                        for (const t of cat.types) {
                          // eslint-disable-next-line no-await-in-loop
                          await toggle(t, ch.key, next);
                        }
                      }}
                      data-testid={`notif-toggle-${cat.key}-${ch.key}`}
                      aria-label={`${cat.label} · ${ch.label}`}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Weekly digest</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            The digest goes out every Sunday at 9pm in your local time. Toggle
            it off above (Weekly digest column) on any category you don't want
            recapped.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
