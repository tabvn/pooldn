import { redirect } from "next/navigation";
import { getClient } from "@/lib/apollo/client";
import { ViewerQuery } from "@/lib/graphql/operations/competition.operations";

export type Viewer = NonNullable<
  Awaited<ReturnType<typeof getClient> extends infer C
    ? C extends { query: (args: never) => Promise<infer R> }
      ? R
      : never
    : never>
>;

export async function getViewer() {
  const { data } = await getClient().query({
    query: ViewerQuery,
    errorPolicy: "ignore",
  });
  return data?.viewer ?? null;
}

export async function requireViewer({
  next,
  roles,
}: { next?: string; roles?: readonly string[] } = {}) {
  const viewer = await getViewer();
  if (!viewer) {
    const param = next ? `?next=${encodeURIComponent(next)}` : "";
    redirect(`/sign-in${param}`);
  }
  if (roles && !roles.includes(viewer.role)) {
    redirect("/");
  }
  return viewer;
}
