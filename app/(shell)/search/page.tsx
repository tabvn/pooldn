import { Search } from "lucide-react";
import { PageTitle } from "@/components/layout/page-title";
import { SearchResults } from "./view";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const kindRaw = typeof sp.kind === "string" ? sp.kind : "";
  const KINDS = ["COMPETITION", "TEAM", "PLAYER", "VENUE", "POST"] as const;
  const kind = (KINDS as readonly string[]).includes(kindRaw)
    ? (kindRaw as (typeof KINDS)[number])
    : null;

  return (
    <div className="flex flex-col">
      <PageTitle
        title="Search"
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <Search className="size-3.5" /> Full-text
          </span>
        }
      />
      <div className="mx-auto max-w-5xl p-6 md:p-10">
        <SearchResults initialQ={q} initialKind={kind} />
      </div>
    </div>
  );
}
