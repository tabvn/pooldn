import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · PoolDN",
  description: "How PoolDN collects, uses, and protects your data.",
};

const UPDATED = "June 9, 2026";
const CONTACT = "support@thebaycity.dev";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-foreground">Privacy Policy</h1>
      <p className="mt-1 text-sm text-mist-400">Last updated: {UPDATED}</p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-foreground/80">
        <p>
          This Privacy Policy explains how PoolDN (&quot;PoolDN&quot;,
          &quot;we&quot;, &quot;us&quot;) collects, uses, and shares information
          when you use our pool &amp; billiards league platform at
          pooldn.thebaycity.dev (the &quot;Service&quot;).
        </p>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Information we collect</h2>
          <p>
            <strong>Account information</strong> — when you register with email,
            or sign in with Google or Facebook, we collect your name, email
            address, and profile photo (avatar). With social sign-in we receive
            this from the provider only after you grant permission; we never
            receive your Google or Facebook password.
          </p>
          <p>
            <strong>Profile &amp; activity</strong> — information you add (bio,
            city, nationality), the teams and competitions you join, match
            results, rankings, and content you post in the community.
          </p>
          <p>
            <strong>Technical data</strong> — session cookies needed to keep you
            signed in, and basic security/rate-limit metadata (such as IP
            address) used to protect the Service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">How we use your information</h2>
          <p>
            To create and secure your account, operate league features (teams,
            competitions, matches, standings, rankings), send relevant
            notifications, respond to support requests, and protect against
            abuse. We do not sell your personal information.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Sharing</h2>
          <p>
            Profile details you choose to make public (name, avatar, team
            membership, results) are visible to other users. We share data with
            service providers that help us run the Service (e.g. hosting,
            email delivery) under appropriate safeguards, and when required by
            law. Authentication is provided by Google and Facebook when you use
            social sign-in.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Data retention &amp; your rights</h2>
          <p>
            We keep your information for as long as your account is active. You
            can access and update your details in Settings, and you can request
            deletion of your account and associated data at any time — see our{" "}
            <a href="/data-deletion" className="text-primary underline">
              Data Deletion instructions
            </a>
            . Depending on your location you may have rights to access, correct,
            export, or erase your data.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Children</h2>
          <p>
            The Service is not directed to children under 13 (or the minimum age
            required in your country), and we do not knowingly collect their
            data.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Changes &amp; contact</h2>
          <p>
            We may update this policy and will revise the date above. Questions
            or requests:{" "}
            <a href={`mailto:${CONTACT}`} className="text-primary underline">
              {CONTACT}
            </a>
            .
          </p>
        </section>

        <p className="text-xs text-mist-400">
          This document is a starting template and should be reviewed by legal
          counsel and tailored to your operating entity and jurisdiction before
          you rely on it.
        </p>
      </div>
    </div>
  );
}
