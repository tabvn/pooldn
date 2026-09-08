import { requireViewer } from "@/lib/auth/server";
import { PageTitle } from "@/components/layout/page-title";
import { ClaimsView } from "./view";

/**
 * Round-88 — one screen for placeholder-profile claims, from both sides:
 * requests the viewer filed on placeholders, and (for organizers/admins) the
 * requests waiting on their decision. Notifications about claims land here via
 * the profile page's review nudge.
 */
export default async function ClaimsPage() {
  const viewer = await requireViewer({ next: "/claims" });
  return (
    <div className="flex flex-col">
      <PageTitle
        title="Profile claims"
        description="Placeholder profiles let organizers run a competition before everyone in it has a PoolDN account. This is where those profiles get handed to the real players."
      />
      <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-4 md:px-10 md:py-6">
        <ClaimsView isAdmin={viewer.role === "SUPER_ADMIN"} />
      </div>
    </div>
  );
}
