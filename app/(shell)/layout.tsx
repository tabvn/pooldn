import type { ReactNode } from "react";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { getClient } from "@/lib/apollo/client";
import { ViewerQuery } from "@/lib/graphql/operations/competition.operations";

export default async function ShellLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { data } = await getClient().query({
    query: ViewerQuery,
    errorPolicy: "ignore",
  });

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Header
          city={
            data?.viewer?.city
              ? `${data.viewer.city.name}, ${data.viewer.city.country.name}`
              : "Da Nang, Vietnam"
          }
          viewerName={data?.viewer?.name ?? null}
          viewerUsername={data?.viewer?.username ?? null}
          viewerAvatarUrl={data?.viewer?.avatarUrl ?? null}
        />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
