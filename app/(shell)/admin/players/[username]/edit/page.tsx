import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageTitle } from "@/components/layout/page-title";
import { getClient } from "@/lib/apollo/client";
import { ProfileByUsernameQuery } from "@/lib/graphql/operations/profile.operations";
import { AdminEditPlayerForm } from "./form";

export default async function AdminEditPlayerPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  await requireViewer({
    next: `/admin/players/${username}/edit`,
    roles: ["SUPER_ADMIN"],
  });
  const { data } = await getClient().query({
    query: ProfileByUsernameQuery,
    variables: { username },
  });
  const user = data?.userByUsername;
  if (!user) notFound();

  return (
    <div className="flex flex-col">
      <PageTitle
        title={`Edit ${user.name}`}
        eyebrow={<span>Admin · @{user.username}</span>}
      />
      <div className="p-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Player details</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminEditPlayerForm
              user={{
                id: user.id,
                name: user.name,
                username: user.username,
                bio: user.bio,
                nationality: user.nationality,
                role: user.role,
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
