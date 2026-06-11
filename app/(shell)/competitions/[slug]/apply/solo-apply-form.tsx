"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client/react";
import { AlertCircle, ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { ApplyToCompetitionMutation } from "@/lib/graphql/operations/competition-mutations.operations";
import { CompetitionHeaderQuery } from "@/lib/graphql/operations/competition.operations";

/**
 * Round-53 — apply form for INDIVIDUAL (Singles) competitions.
 *
 * Solo registration: no team, no roster, no Roster Captain. The viewer
 * registers themselves with an optional message. Mirrors the gating
 * panel from the TEAMS apply form (already-applied / closed / invite-
 * only) so the captain sees the reason explicitly instead of a silent
 * redirect.
 */
export function SoloApplyForm({ slug }: { slug: string }) {
  const router = useRouter();
  const toast = useToast();
  const [message, setMessage] = useState("");

  const compQuery = useQuery(CompetitionHeaderQuery, { variables: { slug } });
  const [apply, { loading }] = useMutation(ApplyToCompetitionMutation);

  const competition = compQuery.data?.competition;
  const existing = competition?.myTeamApplication ?? null;

  function gateReason(): { title: string; detail: string; hint?: string } | null {
    if (!competition) return null;
    if (existing) {
      if (existing.status === "APPROVED") {
        return {
          title: "You're already in",
          detail: "Your application is approved.",
        };
      }
      if (existing.status === "PENDING") {
        return {
          title: "Application already submitted",
          detail: "The organizer is reviewing your application.",
          hint: "You'll be notified here as soon as they respond.",
        };
      }
      if (existing.status === "WAITLISTED") {
        return {
          title: "You're on the waitlist",
          detail: "The organizer has waitlisted your application.",
        };
      }
    }
    if (competition.status !== "OPEN_FOR_APPLICATIONS") {
      return {
        title: "Applications aren't open yet",
        detail: `This competition is currently ${(competition.status ?? "draft").toLowerCase().replace(/_/g, " ")}.`,
      };
    }
    return null;
  }

  async function onSubmit() {
    if (!competition) return;
    try {
      const result = await apply({
        variables: {
          input: {
            competitionId: competition.id,
            teamId: null,
            message: message.trim() || null,
            playerUserIds: [],
            rosterCaptainUserId: null,
          },
        },
      });
      if (result.data?.applyToCompetition) {
        toast.success("Application submitted", "The organizer will review it.");
        router.push(`/competitions/${slug}`);
        router.refresh();
      }
    } catch (e) {
      toast.error(
        "Could not apply",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  const gate = gateReason();
  if (competition && gate) {
    return (
      <div className="mx-auto max-w-2xl p-6 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle>{gate.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
              <AlertCircle className="mt-0.5 size-4 text-warning" />
              <div>
                <div className="font-medium">{gate.detail}</div>
                {gate.hint ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {gate.hint}
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Link href={`/competitions/${slug}`}>
              <Button variant="ghost">
                <ArrowLeft className="size-4" />
                Back to competition
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-6 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Apply to {competition?.name ?? "competition"}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Solo registration — no team or roster needed.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="solo-apply-message"
              className="text-sm font-semibold text-muted-foreground"
            >
              Message to organizer (optional)
            </label>
            <textarea
              id="solo-apply-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="Anything the organizer should know about your entry?"
              className="block w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              data-testid="solo-apply-message"
            />
          </div>
        </CardContent>
        <CardFooter className="justify-between">
          <Link href={`/competitions/${slug}`}>
            <Button variant="ghost">
              <ArrowLeft className="size-4" />
              Cancel
            </Button>
          </Link>
          <Button
            variant="primary"
            loading={loading}
            onClick={onSubmit}
            data-testid="solo-apply-confirm"
          >
            <Check className="size-4" />
            Confirm &amp; Send
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
