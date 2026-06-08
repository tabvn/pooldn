import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth/server";
import { getClient } from "@/lib/apollo/client";
import { VenueDetailQuery } from "@/lib/graphql/operations/venue.operations";
import { VenueForm } from "../../venue-form";

export default async function EditVenuePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireViewer({
    next: `/venues/${slug}/edit`,
    roles: ["ORGANIZER", "SUPER_ADMIN"],
  });
  const { data } = await getClient().query({
    query: VenueDetailQuery,
    variables: { slug },
  });
  const v = data?.venue;
  if (!v) notFound();
  return (
    <VenueForm
      mode={{
        kind: "edit",
        venue: {
          id: v.id,
          slug: v.slug,
          name: v.name,
          address: v.address,
          phone: v.phone ?? null,
          email: v.email ?? null,
          website: v.website ?? null,
          tableCount: v.tableCount ?? null,
          imageUrl: v.imageUrl ?? null,
          city: { id: v.city.id },
        },
      }}
    />
  );
}
