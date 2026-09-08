"use client";

import { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { CheckCircle2, GitMerge, Trophy, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { ClaimProfileMutation } from "@/lib/graphql/operations/claim.operations";
import { MergeClaimIntoMyAccountMutation } from "@/lib/graphql/operations/league-import.operations";
import { errorText } from "@/lib/apollo/error-message";

type Preview = {
  name: string;
  username: string;
  avatarUrl?: string | null;
  teams: string[];
  competitions: string[];
  matchesPlayed: number;
  framesPlayed: number;
  framesWon: number;
};

export function ClaimForm({
  token,
  preview,
  signedInName,
}: {
  token: string;
  preview: Preview;
  signedInName: string | null;
}) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [claim, { loading }] = useMutation(ClaimProfileMutation);
  const [mergeIntoMine, { loading: merging }] = useMutation(
    MergeClaimIntoMyAccountMutation,
  );

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 px-4 py-10 md:py-14">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-primary">Is this you?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Claim this profile to take over its full history and keep playing as
          your own account.
        </p>
      </div>

      {/* Preview card */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <Avatar
            size="lg"
            src={preview.avatarUrl ?? undefined}
            fallback={preview.name}
          />
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold">{preview.name}</div>
            <div className="truncate text-sm text-muted-foreground">
              @{preview.username}
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Matches" value={preview.matchesPlayed} />
          <Stat label="Frames won" value={preview.framesWon} />
          <Stat label="Frames played" value={preview.framesPlayed} />
        </dl>

        {preview.teams.length > 0 ? (
          <Row icon={<Users className="size-4" />} label="Teams">
            {preview.teams.join(", ")}
          </Row>
        ) : null}
        {preview.competitions.length > 0 ? (
          <Row icon={<Trophy className="size-4" />} label="Competitions">
            {preview.competitions.join(", ")}
          </Row>
        ) : null}
      </div>

      {/* Round-86 — someone who already has an account can fold this
          placeholder into it. Claiming (below) upgrades the shell row itself,
          which only makes sense for a person who has no account yet; before
          this existed, a signed-in player was told to contact the organizer. */}
      {signedInName ? (
        <div className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <GitMerge className="size-4 text-primary" />
            You&apos;re signed in as {signedInName}
          </div>
          <p className="text-xs text-muted-foreground">
            If this placeholder is you, add its history to the account
            you&apos;re already using — every team, match and stat moves across
            and the placeholder disappears. You stay signed in as{" "}
            <strong>{signedInName}</strong>.
          </p>
          <Button
            variant="primary"
            loading={merging}
            className="w-full"
            data-testid="claim-merge"
            onClick={async () => {
              try {
                const r = await mergeIntoMine({ variables: { token } });
                const m = r.data?.mergeClaimIntoMyAccount;
                toast.success(
                  "History added to your account",
                  m
                    ? `${m.matchesMoved} match${m.matchesMoved === 1 ? "" : "es"}, ${m.framesMoved} frame${m.framesMoved === 1 ? "" : "s"} and ${m.teamsMoved} team${m.teamsMoved === 1 ? "" : "s"} moved across.`
                    : undefined,
                );
                window.location.href = "/";
              } catch (err) {
                toast.error(
                  "Could not merge",
                  errorText(err),
                );
              }
            }}
          >
            Add {preview.name}&apos;s history to my account
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Not you? Sign out and leave this link alone — tell the organizer.
          </p>
        </div>
      ) : null}

      {/* Claim form — for a person who doesn't have an account yet. Hidden
          when signed in; that path is the merge above. */}
      {signedInName ? null : (
      <form
        className="space-y-4 rounded-xl border border-border bg-card p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await claim({
              variables: { input: { token, email, password } },
            });
            toast.success("Profile claimed — welcome!");
            // Full navigation so the freshly-set session cookie is picked up,
            // then finish real profile details in onboarding.
            window.location.href = "/onboarding?claimed=1";
          } catch (err) {
            toast.error(
              "Could not claim profile",
              errorText(err),
            );
          }
        }}
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="size-4 text-primary" />
          Yes, this is me — set up sign-in
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="claim-email">Email</Label>
          <Input
            id="claim-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="claim-password">Password</Label>
          <Input
            id="claim-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          loading={loading}
          className="w-full"
        >
          Claim this profile
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          We&apos;ll email a link to verify your address. Not you?{" "}
          <span className="text-foreground">Don&apos;t claim it</span> — tell the
          organizer.
        </p>
      </form>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-background px-2 py-2">
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <span className="text-muted-foreground">{label}: </span>
        <span className="font-medium">{children}</span>
      </div>
    </div>
  );
}
