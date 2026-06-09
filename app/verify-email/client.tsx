"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation } from "@apollo/client/react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { VerifyEmailTokenMutation } from "@/lib/graphql/operations/profile.operations";

export function VerifyEmailClient({ token }: { token: string }) {
  const [verify] = useMutation(VerifyEmailTokenMutation);
  const [status, setStatus] = useState<"loading" | "ok" | "fail">("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await verify({ variables: { token } });
        if (cancelled) return;
        setStatus("ok");
      } catch (e) {
        if (cancelled) return;
        setStatus("fail");
        setMessage(e instanceof Error ? e.message : "Verification failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, verify]);

  if (status === "loading") {
    return (
      <p className="inline-flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Verifying your email…
      </p>
    );
  }
  if (status === "ok") {
    return (
      <>
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <p className="text-sm">
          Your email is confirmed. Thanks — that helps keep your account
          secure.
        </p>
        <Link
          href="/settings"
          className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Back to Settings
        </Link>
      </>
    );
  }
  return (
    <>
      <XCircle className="mx-auto size-10 text-destructive" />
      <p className="text-sm">{message || "This link is invalid or expired."}</p>
      <Link
        href="/settings"
        className="inline-block rounded-md bg-secondary/40 px-4 py-2 text-sm font-semibold hover:bg-secondary"
      >
        Open Settings
      </Link>
    </>
  );
}
