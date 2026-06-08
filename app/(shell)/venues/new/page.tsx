import { requireViewer } from "@/lib/auth/server";
import { VenueForm } from "../venue-form";

export default async function NewVenuePage() {
  await requireViewer({
    next: "/venues/new",
    roles: ["ORGANIZER", "SUPER_ADMIN"],
  });
  return <VenueForm mode={{ kind: "create" }} />;
}
