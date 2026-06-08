import { getViewer } from "@/lib/auth/server";
import { CommunityFeed } from "./feed";

export default async function CommunityPage() {
  const viewer = await getViewer();
  return <CommunityFeed signedIn={!!viewer} />;
}
