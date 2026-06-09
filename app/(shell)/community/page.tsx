import { getViewer } from "@/lib/auth/server";
import { CommunityFeed } from "./feed";

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const tag = typeof sp.tag === "string" ? sp.tag : undefined;
  return <CommunityFeed signedIn={!!viewer} initialTag={tag ?? null} />;
}
