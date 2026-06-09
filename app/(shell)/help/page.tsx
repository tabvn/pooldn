import { LifeBuoy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageTitle } from "@/components/layout/page-title";

const FAQ = [
  {
    q: "How do I create a team?",
    a: "Sign in as a captain or higher, open the Teams sidebar entry, then hit \"Create team\" at the top right. You'll automatically be the captain.",
  },
  {
    q: "How do I apply to a competition with my team?",
    a: "Open the competition's page (you must be the team's captain). When applications are open you'll see Apply with my team — that opens a 4-step wizard for team, roster, message, and review.",
  },
  {
    q: "How do match scores get confirmed?",
    a: "Each captain submits the final score after a match. Matching submissions auto-approve; differing submissions go to the organizer's score-submissions review page.",
  },
  {
    q: "How do I change my email or password?",
    a: "Open Settings from the avatar menu in the top-right and switch to the Account tab. Both changes require your current password.",
  },
  {
    q: "Can I leave a team I'm on?",
    a: "Yes — on the team's page click Leave team and confirm. Captains can't leave; transfer the captaincy first from the Manage roster screen.",
  },
  {
    q: "Why is my application stuck on \"Pending\"?",
    a: "Applications stay pending until the organizer reviews them. You'll get a notification on approval or rejection.",
  },
  {
    q: "I uploaded a new avatar but it didn't change everywhere — why?",
    a: "Hard-refresh the page (Cmd/Ctrl+Shift+R). We cache-bust uploads, but proxies sometimes hold the old image briefly.",
  },
  {
    q: "Where do I report a bug or suggest a feature?",
    a: "Open the Suggest a Feature link in the sidebar (or visit /feedback) — admins will be notified.",
  },
];

export default function HelpPage() {
  return (
    <div className="flex flex-col">
      <PageTitle
        title="Help"
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <LifeBuoy className="size-3.5" /> Frequently asked
          </span>
        }
        description="Quick answers to the most common questions. Can't find what you need? Send us a message via Suggest a Feature."
      />
      <div className="p-8 max-w-3xl space-y-4">
        {FAQ.map((item) => (
          <Card key={item.q}>
            <CardHeader>
              <CardTitle className="text-base">{item.q}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {item.a}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
