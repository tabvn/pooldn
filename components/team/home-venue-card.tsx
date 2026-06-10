"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { Check, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { UpdateTeamMutation } from "@/lib/graphql/operations/team-mutations.operations";
import { VenuesListQuery } from "@/lib/graphql/operations/venue.operations";

/**
 * Round-48 — captain-facing editor for Team.homeVenueId. Lives on the team
 * manage page, between the roster and the invite card. The Figma frame is
 * called "Team Venues" / "Home Venues" / "Where Matches Are Played".
 *
 * The home venue is also the gate for `Competition.requiresHomeVenue`: until
 * a captain sets one here, those competitions reject the team's application.
 */
export function HomeVenueCard({
  teamId,
  currentVenue,
}: {
  teamId: string;
  currentVenue: {
    id: string;
    name: string;
    city: { name: string };
  } | null;
}) {
  const toast = useToast();
  const venuesQuery = useQuery(VenuesListQuery, { variables: {} });
  const [updateTeam, { loading }] = useMutation(UpdateTeamMutation);
  const [editing, setEditing] = useState(false);
  const [draftVenueId, setDraftVenueId] = useState<string>(
    currentVenue?.id ?? "",
  );

  const venues = venuesQuery.data?.venues ?? [];

  async function save() {
    try {
      await updateTeam({
        variables: {
          id: teamId,
          input: { homeVenueId: draftVenueId || null },
        },
      });
      toast.success("Home venue updated");
      setEditing(false);
    } catch (e) {
      toast.error(
        "Could not update",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  return (
    <Card data-testid="home-venue-card">
      <CardHeader>
        <CardTitle>Home venue</CardTitle>
        <p className="text-xs text-muted-foreground">
          Where this team plays its home matches. Required when a competition
          has the "home venue" rule enabled.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!editing ? (
          <>
            {currentVenue ? (
              <div className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm">
                <MapPin className="size-4 text-primary" aria-hidden />
                <div className="flex-1">
                  <div className="font-semibold">{currentVenue.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {currentVenue.city.name}
                  </div>
                </div>
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-border bg-secondary/30 px-3 py-3 text-xs text-muted-foreground">
                No home venue yet — set one so this team can apply to
                competitions that require it.
              </p>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setDraftVenueId(currentVenue?.id ?? "");
                setEditing(true);
              }}
              data-testid="edit-home-venue"
            >
              {currentVenue ? "Change home venue" : "Set home venue"}
            </Button>
          </>
        ) : (
          <>
            <select
              value={draftVenueId}
              onChange={(e) => setDraftVenueId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              data-testid="home-venue-picker"
            >
              <option value="">— No home venue —</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} · {v.city.name}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                loading={loading}
                onClick={save}
                iconBefore={<Check className="size-4" />}
                data-testid="save-home-venue"
              >
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
