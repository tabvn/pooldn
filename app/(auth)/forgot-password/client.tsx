"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import { CheckCircle2, KeyRound, Mail } from "lucide-react";
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

function PanelHeading({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-3 pb-1">
      <span
        aria-hidden
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary"
      >
        {icon}
      </span>
      <div className="space-y-0.5">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <p className="text-xs text-mist-400">{hint}</p>
      </div>
    </div>
  );
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
      toast.error("Could not send reset link", err);
    }
  }

  if (sent) {
    return (
      <div className="space-y-3">
        <PanelHeading
          icon={<CheckCircle2 className="size-5" />}
          title="Check your inbox"
          hint="If an account exists for that address, the link will arrive in a moment."
        />
        <div
          className="rounded-lg border border-success/30 bg-success/10 px-3 py-3 text-sm text-success"
          data-testid="forgot-password-sent"
        >
          We sent a reset link to{" "}
          <strong className="font-mono">{email}</strong>. It expires in
          60 minutes.
        </div>
        <p className="text-xs text-mist-400">
          Didn&apos;t receive it? Check spam, or{" "}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="font-semibold text-primary hover:underline"
          >
            try a different address
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4"
      data-testid="forgot-password-form"
    >
      <PanelHeading
        icon={<Mail className="size-5" />}
        title="Forgot your password?"
        hint="We'll email a link to the address on file. The link expires in 60 minutes."
      />
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

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;

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
      toast.success("Password updated", "Sign in with your new password.");
      router.push("/sign-in");
    } catch (err) {
      toast.error("Could not reset password", err);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4"
      data-testid="reset-password-form"
    >
      <PanelHeading
        icon={<KeyRound className="size-5" />}
        title="Set a new password"
        hint="Use at least 8 characters. We'll sign you in after the change."
      />
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          invalid={tooShort}
        />
        {tooShort ? (
          <p className="text-xs text-destructive">At least 8 characters.</p>
        ) : null}
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
          invalid={mismatch}
        />
        {mismatch ? (
          <p className="text-xs text-destructive">Passwords don&apos;t match.</p>
        ) : null}
      </div>
      <Button
        type="submit"
        block
        loading={loading}
        disabled={tooShort || mismatch || !password || !confirm}
      >
        Reset password
      </Button>
    </form>
  );
}
