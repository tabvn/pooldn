import { notFound } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CountryFlag } from "@/components/ui/country-flag";
import { LocalDateTime } from "@/components/ui/local-datetime";
import { PageTitle } from "@/components/layout/page-title";
import { getClient } from "@/lib/apollo/client";
import { getViewer } from "@/lib/auth/server";
import {
  ProfileByUsernameQuery,
} from "@/lib/graphql/operations/profile.operations";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const [{ data }, viewer] = await Promise.all([
    getClient().query({
      query: ProfileByUsernameQuery,
      variables: { username },
    }),
    getViewer(),
  ]);
  const user = data?.userByUsername;
  if (!user) notFound();

  // Self OR admin can drive the Edit affordance (Round-15 admin rule).
  const isSelf = viewer?.id === user.id;
  const isAdmin = viewer?.role === "SUPER_ADMIN";
  const canEdit = isSelf || isAdmin;
  // user.createdAt is stable across server/client (it's a fixed UTC instant),
  // but the *formatted* string depends on tz/locale. Render via the client
  // LocalDateTime helper to stay hydration-clean.
  void user.createdAt;

  return (
    <div className="flex flex-col">
      <PageTitle
        title={user.name}
        eyebrow={<span>@{user.username}</span>}
        actions={
          canEdit ? (
            <Link href="/settings">
              <Button variant="outline">Edit profile</Button>
            </Link>
          ) : null
        }
        meta={
          <>
            <Badge variant="primary">{user.role.replace(/_/g, " ")}</Badge>
            {user.city ? (
              <span>
                {user.city.name}, {user.city.country.name}
              </span>
            ) : null}
            {user.nationality ? (
              <span className="inline-flex items-center gap-1.5">
                <CountryFlag code={user.nationality} className="text-base leading-none" />
                <span>{user.nationality}</span>
              </span>
            ) : null}
            <span>
              Joined <LocalDateTime value={user.createdAt} variant="date" />
            </span>
          </>
        }
      />
      <div className="p-8 max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar
                size="xl"
                src={user.avatarUrl ?? undefined}
                fallback={user.name}
              />
              <div>
                <CardTitle>{user.name}</CardTitle>
                <p className="text-sm text-muted-foreground">@{user.username}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {user.bio ? (
              <p className="text-foreground">{user.bio}</p>
            ) : (
              <p className="text-muted-foreground italic">
                {isSelf
                  ? "Your bio is empty — tell people who you are."
                  : "This player hasn't written a bio yet."}
              </p>
            )}
            {isSelf ? (
              <div>
                <span className="text-xs text-muted-foreground">Email: </span>
                <span>{user.email}</span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
