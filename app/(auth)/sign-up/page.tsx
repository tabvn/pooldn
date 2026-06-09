"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { RegisterMutation } from "@/lib/graphql/operations/auth.operations";

const schema = z
  .object({
    firstName: z.string().min(1, "Required"),
    lastName: z.string().min(1, "Required"),
    email: z.string().email("Invalid email"),
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string().min(8, "At least 8 characters"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type FormValues = z.infer<typeof schema>;

function deriveUsername(email: string, firstName: string) {
  const local = email.split("@")[0] || firstName;
  return local.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 24);
}

export default function SignUpPage() {
  const router = useRouter();
  const toast = useToast();
  const [registerUser, { error, loading: registering }] = useMutation(
    RegisterMutation,
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      // Username is intentionally omitted — the server auto-generates one
      // from the name and resolves collisions with a numeric suffix so we
      // don't blow up on "username taken" for a UI that doesn't show it.
      const result = await registerUser({
        variables: {
          input: {
            name: `${values.firstName} ${values.lastName}`.trim(),
            email: values.email,
            password: values.password,
          },
        },
      });
      if (result.data?.register) {
        toast.success("Account created", "Set up your profile next.");
        router.push("/onboarding?new=1");
        router.refresh();
      }
    } catch (e) {
      toast.error(
        "Sign up failed",
        e instanceof Error ? e.message : "Try again.",
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">Given Name (First)</Label>
              <Input
                id="firstName"
                placeholder="Given Name"
                autoComplete="given-name"
                invalid={!!errors.firstName}
                {...register("firstName")}
              />
              {errors.firstName ? (
                <p className="text-xs text-destructive">
                  {errors.firstName.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Family Name (Last)</Label>
              <Input
                id="lastName"
                placeholder="Family Name"
                autoComplete="family-name"
                invalid={!!errors.lastName}
                {...register("lastName")}
              />
              {errors.lastName ? (
                <p className="text-xs text-destructive">
                  {errors.lastName.message}
                </p>
              ) : null}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="Email"
              autoComplete="email"
              invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email ? (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Password"
              autoComplete="new-password"
              invalid={!!errors.password}
              {...register("password")}
            />
            {errors.password ? (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Re-Enter Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Password"
              autoComplete="new-password"
              invalid={!!errors.confirmPassword}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword ? (
              <p className="text-xs text-destructive">
                {errors.confirmPassword.message}
              </p>
            ) : null}
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error.message}
            </p>
          ) : null}

          <Button type="submit" block loading={isSubmitting || registering}>
            Create Account
          </Button>
          <Link href="/" className="block">
            <Button type="button" variant="outline" block>
              Continue as Guest
            </Button>
          </Link>
        </form>

        <p className="mt-4 border-t border-white/5 pt-4 text-center text-sm text-mist-400">
          Already have an account?{" "}
          <Link className="font-semibold text-primary hover:underline" href="/sign-in">
            Sign In
          </Link>
        </p>
      </div>
    </>
  );
}
