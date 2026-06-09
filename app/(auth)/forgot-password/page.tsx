import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { WelcomeHeading } from "@/components/auth/welcome-heading";
import { ForgotPasswordClient } from "./client";

/**
 * Round-47 — forgot-password gate. Two states share the same shell:
 *   - no `?token` → "Reset your password" + email-request form
 *   - `?token=…` → "Set a new password" + new-password form
 *
 * Visual treatment mirrors sign-in / sign-up so the auth surfaces feel
 * like one product (WelcomeHeading with the 8-ball logo, lime-tinted
 * card, identical footer link pattern).
 */
export default function ForgotPasswordPage() {
  return (
    <>
      <WelcomeHeading subtitle="Reset your account password" />
      <div className="w-full rounded-2xl border border-white/5 bg-card p-6 shadow-2xl space-y-5">
        <Suspense fallback={null}>
          <ForgotPasswordClient />
        </Suspense>
        <div className="border-t border-white/5 pt-4">
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            <ArrowLeft className="size-3.5" />
            Back to Sign In
          </Link>
        </div>
      </div>
      <p className="mt-6 text-center text-xs text-mist-400">
        Need help?{" "}
        <Link href="/help" className="font-semibold text-primary hover:underline">
          Contact support
        </Link>
      </p>
    </>
  );
}
