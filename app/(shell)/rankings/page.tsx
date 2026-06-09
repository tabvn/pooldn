import { PageTitle } from "@/components/layout/page-title";
import { RankingsBoard } from "./board";

export default function RankingsPage() {
  return (
    <div className="flex flex-col">
      <PageTitle
        title="Rankings"
        eyebrow={<span>Top players by rating</span>}
      />
      <div className="p-4 md:p-8 max-w-4xl">
        <RankingsBoard />
      </div>
    </div>
  );
}
