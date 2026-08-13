import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "About · PoolDN",
  description:
    "PoolDN is a pool & billiards league platform built by pool enthusiasts.",
};

const CONTACT = "toan@thebay.city";

export default function AboutPage() {
  return (
    <div className="max-w-3xl space-y-6 text-sm leading-relaxed text-foreground/80">
      <section className="space-y-3">
        <p>
          PoolDN is a home for pool &amp; billiards leagues — a place to run
          competitions, build teams, track match results, and follow the local
          scene. It started as a weekend project among a handful of players who
          were tired of juggling group chats, spreadsheets, and paper brackets
          just to keep a league running.
        </p>
        <p>
          We&apos;re not a big company. We&apos;re pool enthusiasts building the
          tool we wished existed: fast to set up, honest about scores, and made
          for the way real leagues actually play — from round-robin seasons to
          single-day knockout brackets.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What you can do</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Create competitions, register teams and rosters, schedule matchdays,
            record frame-by-frame results, and watch standings and player MVP
            ratings update automatically.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Who it&apos;s for</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Organizers who run leagues, captains who manage teams, and players
            who just want to show up, play, and see where they rank.
          </CardContent>
        </Card>
      </div>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Get in touch</h2>
        <p>
          Found a bug, have an idea, or want to bring your league on board? Reach
          us any time via the{" "}
          <Link href="/feedback" className="text-primary underline">
            Suggest a Feature
          </Link>{" "}
          page, browse the{" "}
          <Link href="/about/help" className="text-primary underline">
            Help
          </Link>{" "}
          answers, or email{" "}
          <a href={`mailto:${CONTACT}`} className="text-primary underline">
            {CONTACT}
          </a>
          .
        </p>
      </section>

      <p className="text-xs text-muted-foreground">
        By using PoolDN you agree to our{" "}
        <Link href="/about/terms" className="text-primary underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/about/privacy" className="text-primary underline">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
