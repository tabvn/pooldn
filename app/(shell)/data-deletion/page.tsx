import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Deletion · PoolDN",
  description: "How to delete your PoolDN account and personal data.",
};

const CONTACT = "toan@thebay.city";

export default function DataDeletionPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-foreground">Data Deletion</h1>
      <p className="mt-1 text-sm text-mist-400">
        How to delete your PoolDN account and the data associated with it.
      </p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-foreground/80">
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Delete from your account</h2>
          <p>
            Sign in, open <strong>Settings</strong> from the avatar menu in the
            top-right, go to the <strong>Account</strong> tab, and choose{" "}
            <strong>Delete account</strong>. This permanently removes your
            profile, avatar, and personal data, and detaches you from teams and
            competitions.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Request by email</h2>
          <p>
            If you signed in with Google or Facebook and can&apos;t access your
            account, email{" "}
            <a href={`mailto:${CONTACT}`} className="text-primary underline">
              {CONTACT}
            </a>{" "}
            from the address on your account with the subject &quot;Delete my
            data&quot;. We will verify your request and delete your data within
            30 days.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">What gets deleted</h2>
          <p>
            Your account, profile details (name, email, avatar, bio), and the
            personal data we hold about you. Some records may be retained in
            anonymized form (e.g. historical match results that involve other
            players), or as required by law. Backups are purged on their normal
            rotation.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Facebook &amp; Google sign-in</h2>
          <p>
            Deleting your PoolDN account removes the data we received from
            Facebook or Google. You can also revoke PoolDN&apos;s access from your
            Facebook settings (Settings &amp; privacy → Apps and Websites) or
            Google account (Security → Third-party access) at any time.
          </p>
        </section>
      </div>
    </div>
  );
}
