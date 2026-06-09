import { requireViewer } from "@/lib/auth/server";
import { LocationsAdmin } from "./view";

export default async function AdminLocationsPage() {
  await requireViewer({ next: "/admin/locations", roles: ["SUPER_ADMIN"] });
  return <LocationsAdmin />;
}
