"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import {
  RequestPasswordResetMutation,
  ResetPasswordMutation,
} from "@/lib/graphql/operations/profile.operations";

/**
 * Round-47 — two states in one page:
 *   - no `?token` → request form (email input → server emails link)
 *   - `?token=…` → reset form (new password + confirm → server consumes token)
 */
export function ForgotPasswordClient() {
  const sp = useSearchParams();
  const token = sp.get("token");
  if (token) return <ResetForm token={token} />;
  return <RequestForm />;
}

function RequestForm() {
  const toast = useToast();
  const [request, { loading }] = useMutation(RequestPasswordResetMutation);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    try {
      await request({ variables: { email: trimmed } });
      setSent(true);
    } catch (err) {
      // Server always returns true, so a thrown error here means a network
      // failure — keep the message generic.
      toast.error("Could not send reset link", err);
    }
  }

  if (sent) {
    return (
      <div
        className="space-y-2 rounded-md border border-success/30 bg-success/10 px-3 py-3 text-sm text-success"
        data-testid="forgot-password-sent"
      >
        <p className="inline-flex items-center gap-1.5 font-semibold">
          <CheckCircle2 className="size-4" /> Check your inbox
        </p>
        <p className="text-success/90">
          If an account exists for <strong>{email}</strong>, we just sent
          a reset link. It expires in 60 minutes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" data-testid="forgot-password-form">
      <p className="text-sm text-mist-400">
        Enter the email on your PoolDN account and we'll send a reset link.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </div>
      <Button type="submit" block loading={loading}>
        Send reset link
      </Button>
    </form>
  );
}

function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const toast = useToast();
  const [reset, { loading }] = useMutation(ResetPasswordMutation);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Pick a longer password", "At least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    try {
      await reset({ variables: { token, newPassword: password } });
      toast.success(
        "Password updated",
        "Sign in with your new password.",
      );
      router.push("/sign-in");
    } catch (err) {
      toast.error("Could not reset password", err);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" data-testid="reset-password-form">
      <p className="text-sm text-mist-400">Pick a new password — at least 8 characters.</p>
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      <Button type="submit" block loading={loading}>
        Reset password
      </Button>
    </form>
  );
}
