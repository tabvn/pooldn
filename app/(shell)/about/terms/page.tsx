import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service · PoolDN",
  description: "The terms that govern your use of PoolDN.",
};

const UPDATED = "June 9, 2026";
const CONTACT = "toan@thebay.city";

export default function TermsPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-foreground">Terms of Service</h1>
      <p className="mt-1 text-sm text-muted-foreground">Last updated: {UPDATED}</p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed text-foreground/80">
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and
          use of PoolDN (the &quot;Service&quot;) at pooldn.thebaycity.dev. By
          creating an account or using the Service you agree to these Terms.
        </p>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Eligibility &amp; accounts</h2>
          <p>
            You must be at least 13 years old (or the minimum age in your
            country) to use the Service. You are responsible for the activity on
            your account and for keeping your credentials secure. Provide
            accurate information and keep it up to date.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Acceptable use</h2>
          <p>
            Don&apos;t misuse the Service: no unlawful, harassing, infringing, or
            harmful content; no attempts to disrupt, reverse-engineer, scrape, or
            gain unauthorized access; no impersonation or cheating in
            competitions. We may remove content or suspend accounts that violate
            these Terms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Your content</h2>
          <p>
            You retain ownership of content you submit (team info, posts,
            images). You grant us a license to host and display it as needed to
            operate the Service. You&apos;re responsible for having the rights to
            anything you upload.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Termination</h2>
          <p>
            You may delete your account at any time (see{" "}
            <a href="/data-deletion" className="text-primary underline">
              Data Deletion
            </a>
            ). We may suspend or terminate access for violations of these Terms
            or to protect the Service and its users.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Disclaimers &amp; liability</h2>
          <p>
            The Service is provided &quot;as is&quot; without warranties of any
            kind. To the maximum extent permitted by law, PoolDN is not liable
            for indirect, incidental, or consequential damages arising from your
            use of the Service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Changes &amp; contact</h2>
          <p>
            We may update these Terms and will revise the date above; continued
            use means you accept the changes. Questions:{" "}
            <a href={`mailto:${CONTACT}`} className="text-primary underline">
              {CONTACT}
            </a>
            .
          </p>
        </section>

        <p className="text-xs text-muted-foreground">
          This document is a starting template and should be reviewed by legal
          counsel and tailored to your operating entity and governing law before
          you rely on it.
        </p>
      </div>
    </div>
  );
}
