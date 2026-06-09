import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import {
  NotificationToaster,
  NotificationToasterContainer,
} from "@/components/layout/notification-toaster";
import { Sidebar } from "@/components/layout/sidebar";
import { getClient } from "@/lib/apollo/client";
import { CitiesQuery, ViewerQuery } from "@/lib/graphql/operations/competition.operations";

export default async function ShellLayout({
  children,
}: {
  children: ReactNode;
}) {
  const client = getClient();
  const [{ data }, citiesRes, cookieStore] = await Promise.all([
    client.query({ query: ViewerQuery, errorPolicy: "ignore" }),
    client.query({ query: CitiesQuery, errorPolicy: "ignore" }),
    cookies(),
  ]);

  // Round-45 — header city precedence:
  //   1. `pooldn_city` cookie ("all" = global; "<cityId>" = scoped; missing = fall through)
  //   2. viewer's profile city (implicit default for signed-in users)
  //   3. seed default ("Da Nang, Vietnam") for guests
  const pickedCityId = cookieStore.get("pooldn_city")?.value;
  const allCities = citiesRes.data?.cities ?? [];
  let label: string;
  // R45+ — single active city: there's no real choice; pin the label to
  // that city and ignore any "all" cookie value.
  if (allCities.length === 1) {
    const only = allCities[0]!;
    label = `${only.name}, ${only.country.name}`;
  } else if (pickedCityId === "all") {
    label = "All cities";
  } else if (pickedCityId) {
    const picked = allCities.find((c) => c.id === pickedCityId);
    label = picked
      ? `${picked.name}, ${picked.country.name}`
      : "Da Nang, Vietnam";
  } else {
    label = data?.viewer?.city
      ? `${data.viewer.city.name}, ${data.viewer.city.country.name}`
      : "Da Nang, Vietnam";
  }

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Header
          city={label}
          viewerName={data?.viewer?.name ?? null}
          viewerUsername={data?.viewer?.username ?? null}
          viewerAvatarUrl={data?.viewer?.avatarUrl ?? null}
        />
        <main className="flex-1 overflow-auto pb-16 md:pb-0">{children}</main>
      </div>
      <MobileNav />
      <NotificationToaster enabled={!!data?.viewer} />
      <NotificationToasterContainer
        position="top-right"
        richColors
        visibleToasts={3}
        closeButton
      />
    </div>
  );
}
