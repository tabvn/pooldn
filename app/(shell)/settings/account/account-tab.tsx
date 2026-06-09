"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Lock, Mail, ShieldAlert } from "lucide-react";
import { useMutation, useQuery } from "@apollo/client/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import {
  ChangeEmailMutation,
  ChangePasswordMutation,
  DeactivateAccountMutation,
  ResendEmailVerificationMutation,
  ViewerSettingsQuery,
} from "@/lib/graphql/operations/profile.operations";

/**
 * Account tab — two focused mini-forms in collapsible sections so the page
 * stays calm until you actually need to change something. Click "Change…"
 * to expand the form for that field.
 */
export function AccountTab() {
  const toast = useToast();
  const { data, refetch } = useQuery(ViewerSettingsQuery);
  const viewer = data?.viewer;

  if (!viewer) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="max-w-xl space-y-4">
      <EmailSection
        currentEmail={viewer.email}
        emailVerified={viewer.emailVerified}
        onSaved={async () => {
          await refetch();
          toast.success("Email updated");
        }}
      />
      <PasswordSection
        onSaved={() => {
          toast.success("Password updated");
        }}
      />
      <DangerZone username={viewer.username} />
    </div>
  );
}

function DangerZone({ username }: { username: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [deactivate, { loading }] = useMutation(DeactivateAccountMutation);
  const matches = confirm === username;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!matches) return;
    try {
      await deactivate({
        variables: { currentPassword: password, confirmUsername: confirm },
      });
      toast.success(
        "Account deactivated",
        "We've signed you out. Contact support to reactivate.",
      );
      // Hard-redirect so the auth cookie is cleared on the next request.
      router.push("/sign-in");
      router.refresh();
    } catch (err) {
      toast.error("Could not deactivate", err);
    }
  }

  return (
    <Card className="border-destructive/30" data-testid="account-danger">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-4" /> Danger zone
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Deactivate your account. You'll be signed out and your profile
              hidden. Reactivation requires an admin.
            </p>
          </div>
          <Button
            variant={open ? "ghost" : "outline"}
            size="sm"
            onClick={() => setOpen((v) => !v)}
            data-testid="open-deactivate"
          >
            {open ? "Cancel" : "Deactivate account"}
          </Button>
        </div>
      </CardHeader>
      {open ? (
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="deactivatePw">Current password</Label>
              <Input
                id="deactivatePw"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deactivateConfirm">
                Type <span className="font-mono">{username}</span> to confirm
              </Label>
              <Input
                id="deactivateConfirm"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                invalid={!!confirm && !matches}
                data-testid="deactivate-confirm"
              />
            </div>
            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                variant="danger"
                loading={loading}
                disabled={!password || !matches}
                data-testid="deactivate-submit"
              >
                Deactivate account
              </Button>
            </div>
          </form>
        </CardContent>
      ) : null}
    </Card>
  );
}

function EmailSection({
  currentEmail,
  emailVerified,
  onSaved,
}: {
  currentEmail: string;
  emailVerified: boolean;
  onSaved: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [save, { loading }] = useMutation(ChangeEmailMutation);
  const [resend, { loading: resending }] = useMutation(
    ResendEmailVerificationMutation,
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save({ variables: { newEmail: email.trim(), currentPassword: password } });
      setOpen(false);
      setEmail("");
      setPassword("");
      await onSaved();
    } catch (err) {
      toast.error("Could not update email", err);
    }
  }

  async function onResend() {
    try {
      await resend();
      toast.success("Verification email queued");
    } catch (err) {
      toast.error("Could not resend", err);
    }
  }

  return (
    <Card data-testid="account-email">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" /> Email
              {emailVerified ? (
                <Badge variant="success" size="sm">
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="size-3" /> Verified
                  </span>
                </Badge>
              ) : (
                <Badge variant="warning" size="sm">
                  <span className="inline-flex items-center gap-1">
                    <ShieldAlert className="size-3" /> Unverified
                  </span>
                </Badge>
              )}
            </CardTitle>
            <p className="text-sm font-mono text-muted-foreground">
              {currentEmail}
            </p>
            {!emailVerified ? (
              <Button
                variant="ghost"
                size="sm"
                loading={resending}
                onClick={onResend}
                data-testid="resend-verification"
              >
                Resend verification
              </Button>
            ) : null}
          </div>
          <Button
            variant={open ? "ghost" : "outline"}
            size="sm"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Cancel" : "Change email"}
          </Button>
        </div>
      </CardHeader>
      {open ? (
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="newEmail">New email</Label>
              <Input
                id="newEmail"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emailPw">Confirm with current password</Label>
              <Input
                id="emailPw"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                loading={loading}
                disabled={!email || !password}
              >
                Update email
              </Button>
            </div>
          </form>
        </CardContent>
      ) : null}
    </Card>
  );
}

function PasswordSection({
  onSaved,
}: {
  onSaved: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [save, { loading }] = useMutation(ChangePasswordMutation);

  const mismatch = !!confirm && next !== confirm;
  const tooShort = !!next && next.length < 8;
  // Very basic strength heuristic (length + character classes). Enough to
  // surface a 0–4 meter without dragging in a real entropy library.
  const strength = useMemo(() => {
    if (!next) return 0;
    let s = 0;
    if (next.length >= 8) s++;
    if (next.length >= 12) s++;
    if (/[A-Z]/.test(next) && /[a-z]/.test(next)) s++;
    if (/\d/.test(next)) s++;
    if (/[^A-Za-z0-9]/.test(next)) s++;
    return Math.min(s, 4);
  }, [next]);
  const strengthLabel = ["Too short", "Weak", "Fair", "Good", "Strong"][strength] ?? "";
  const strengthColor = [
    "bg-destructive",
    "bg-destructive",
    "bg-amber-500",
    "bg-primary",
    "bg-success",
  ][strength];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mismatch || tooShort) return;
    try {
      await save({
        variables: { currentPassword: current, newPassword: next },
      });
      setOpen(false);
      setCurrent("");
      setNext("");
      setConfirm("");
      await onSaved();
    } catch (err) {
      toast.error(
        "Could not update password",
        err instanceof Error ? err.message : undefined,
      );
    }
  }

  return (
    <Card data-testid="account-password">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Lock className="size-4 text-muted-foreground" /> Password
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              At least 8 characters. You'll stay signed in on this device.
            </p>
          </div>
          <Button
            variant={open ? "ghost" : "outline"}
            size="sm"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Cancel" : "Change password"}
          </Button>
        </div>
      </CardHeader>
      {open ? (
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="currentPw">Current password</Label>
              <Input
                id="currentPw"
                type="password"
                autoComplete="current-password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPw">New password</Label>
              <Input
                id="newPw"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
              {next ? (
                <div className="space-y-1" data-testid="password-strength">
                  <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full transition-all ${strengthColor}`}
                      style={{ width: `${((strength + 1) / 5) * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={
                        strength >= 3
                          ? "text-success"
                          : strength === 2
                            ? "text-amber-500"
                            : "text-destructive"
                      }
                    >
                      {strengthLabel}
                    </span>
                    {tooShort ? (
                      <span className="text-destructive">
                        Use at least 8 characters.
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPw">Confirm new password</Label>
              <Input
                id="confirmPw"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              {mismatch ? (
                <p className="text-xs text-destructive">
                  Passwords don't match.
                </p>
              ) : null}
            </div>
            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                loading={loading}
                disabled={!current || !next || mismatch || tooShort}
              >
                Update password
              </Button>
            </div>
          </form>
        </CardContent>
      ) : null}
    </Card>
  );
}
