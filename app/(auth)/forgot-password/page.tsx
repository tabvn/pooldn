import { Suspense } from "react";
import Link from "next/link";
import { ForgotPasswordClient } from "./client";

export default function ForgotPasswordPage() {
  return (
    <div className="w-full rounded-2xl border border-white/5 bg-card p-6 shadow-2xl space-y-4">
      <h1 className="text-xl font-semibold text-white">Reset your password</h1>
      <Suspense fallback={null}>
        <ForgotPasswordClient />
      </Suspense>
      <Link
        href="/sign-in"
        className="block text-center text-sm font-semibold text-primary hover:underline"
      >
        ← Back to Sign In
      </Link>
    </div>
  );
}
