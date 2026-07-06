"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useApolloClient, useMutation } from "@apollo/client/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { WelcomeHeading } from "@/components/auth/welcome-heading";
import { OrDivider, SocialButtons } from "@/components/auth/social-buttons";
import { DemoAccounts } from "@/components/auth/demo-accounts";
import { LoginMutation } from "@/lib/graphql/operations/auth.operations";

const schema = z.object({
  usernameOrEmail: z.string().min(1, "Required"),
  password: z.string().min(1, "Required"),
});

type FormValues = z.infer<typeof schema>;

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}

type LockOut = { until: number; secs: number };

function extractRateLimit(err: unknown): LockOut | null {
  // Apollo's error object surfaces graphQLErrors with extensions on each.
  // Walk the array defensively — the shape is { graphQLErrors: [...] }
  // or { cause: { result: { errors: [...] }}}, depending on the version.
  type GqlExt = { code?: string; retryAfterSec?: number };
  type GqlErr = { extensions?: GqlExt };
  type ApolloLike = { graphQLErrors?: GqlErr[] };
  const ge = (err as ApolloLike | undefined)?.graphQLErrors;
  if (!ge) return null;
  for (const e of ge) {
    const ext = e.extensions;
    if (ext?.code === "RATE_LIMITED" && typeof ext.retryAfterSec === "number") {
      return {
        until: Date.now() + ext.retryAfterSec * 1000,
        secs: ext.retryAfterSec,
      };
    }
  }
  return null;
}

function SignInForm() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const nextHref = searchParams.get("next") ?? "/";
  const authError = searchParams.get("authError");
  const authErrorMessage = authError
    ? ({
        google_unconfigured:
          "Google sign-in isn't configured yet. Add the OAuth credentials and try again.",
        google_denied: "Google sign-in was cancelled.",
        google_state: "Your sign-in session expired. Please try again.",
        google_email_unverified:
          "Your Google email isn't verified. Verify it with Google, then retry.",
        account_suspended: "This account has been suspended.",
        google_failed: "Google sign-in failed. Please try again.",
        facebook_unconfigured:
          "Facebook sign-in isn't configured yet. Add the OAuth credentials and try again.",
        facebook_denied: "Facebook sign-in was cancelled.",
        facebook_state: "Your sign-in session expired. Please try again.",
        facebook_no_email:
          "Facebook didn't share an email for your account. Please use Google or email sign-up, or grant email permission and retry.",
        facebook_failed: "Facebook sign-in failed. Please try again.",
      }[authError] ?? "Sign-in failed. Please try again.")
    : null;
  const client = useApolloClient();
  const [login, { error, loading: loggingIn }] = useMutation(LoginMutation);
  const [lockOut, setLockOut] = useState<LockOut | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Tick once a second while we're locked out so the countdown stays live.
  useEffect(() => {
    if (!lockOut) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lockOut]);

  const remainingSec = lockOut
    ? Math.max(0, Math.ceil((lockOut.until - now) / 1000))
    : 0;
  const locked = remainingSec > 0;

  const onSubmit = handleSubmit(async (values) => {
    if (locked) return;
    try {
      const result = await login({ variables: { input: values } });
      if (result.data?.login) {
        await client.clearStore();
        router.push(nextHref);
        router.refresh();
      }
    } catch (e) {
      const rl = extractRateLimit(e);
      if (rl) {
        setLockOut(rl);
        setNow(Date.now());
        return;
      }
      toast.error(
        "Sign in failed",
        e instanceof Error ? e.message : "Check your credentials and try again.",
      );
    }
  });

  return (
    <>
      <WelcomeHeading subtitle="Join the Community" />
      <div className="w-full rounded-2xl border border-white/5 bg-card p-6 shadow-2xl">
        {authErrorMessage ? (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {authErrorMessage}
          </div>
        ) : null}
        <SocialButtons next={nextHref} />
        <OrDivider />

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="usernameOrEmail">Email or username</Label>
            <Input
              id="usernameOrEmail"
              autoComplete="username"
              placeholder="you@example.com"
              invalid={!!errors.usernameOrEmail}
              {...register("usernameOrEmail")}
            />
            {errors.usernameOrEmail ? (
              <p className="text-xs text-destructive">
                {errors.usernameOrEmail.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-xs font-semibold text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              invalid={!!errors.password}
              {...register("password")}
            />
            {errors.password ? (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            ) : null}
          </div>

          {locked ? (
            <p
              className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning"
              role="alert"
              data-testid="signin-rate-limited"
            >
              Too many sign-in attempts. Try again in{" "}
              <span className="font-mono font-bold tabular-nums">
                {remainingSec}s
              </span>
              .
            </p>
          ) : error ? (
            <p className="text-sm text-destructive" role="alert">
              {error.message}
            </p>
          ) : null}

          <Button
            type="submit"
            block
            loading={isSubmitting || loggingIn}
            disabled={locked}
          >
            {locked ? `Locked · ${remainingSec}s` : "Sign In"}
          </Button>
          <Link href="/" className="block">
            <Button type="button" variant="outline" block>
              Continue as Guest
            </Button>
          </Link>
        </form>

        <p className="mt-4 border-t border-white/5 pt-4 text-center text-sm text-mist-400">
          Don&apos;t have an account?{" "}
          <Link className="font-semibold text-primary hover:underline" href="/sign-up">
            Sign Up
          </Link>
        </p>
      </div>

      <DemoAccounts />
    </>
  );
}
