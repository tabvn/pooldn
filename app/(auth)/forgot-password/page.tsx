import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <div className="w-full rounded-2xl border border-white/5 bg-card p-6 shadow-2xl space-y-4">
      <h1 className="text-xl font-semibold text-white">Forgot your password?</h1>
      <p className="text-sm text-mist-400">
        Password reset isn&apos;t wired up yet — message your league organizer
        and they can reset it for you.
      </p>
      <Link
        href="/sign-in"
        className="block text-center text-sm font-semibold text-primary hover:underline"
      >
        ← Back to Sign In
      </Link>
    </div>
  );
}
