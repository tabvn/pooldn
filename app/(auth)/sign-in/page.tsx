"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@apollo/client/react";
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

function SignInForm() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const nextHref = searchParams.get("next") ?? "/";
  const [login, { error, loading: loggingIn }] = useMutation(LoginMutation);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await login({ variables: { input: values } });
      if (result.data?.login) {
        router.push(nextHref);
        router.refresh();
      }
    } catch (e) {
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
        <SocialButtons />
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

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error.message}
            </p>
          ) : null}

          <Button type="submit" block loading={isSubmitting || loggingIn}>
            Sign In
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
