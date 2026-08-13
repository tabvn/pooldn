import { Lightbulb } from "lucide-react";
import { DetailHero } from "@/components/layout/detail-hero";
import { FeedbackForm } from "./form";

export default function FeedbackPage() {
  return (
    <div className="flex flex-col">
      {/* Round-74 — compact DetailHero + centered content, matching the
          Edit Profile / About screens and the rest of the app. */}
      <DetailHero
        title="Suggest a Feature"
        meta={
          <span className="inline-flex items-center gap-2">
            <Lightbulb className="size-3.5" /> Tell us what&apos;s missing or
            broken — admins are notified directly.
          </span>
        }
      />
      <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-10 md:py-8">
        <FeedbackForm />
      </div>
    </div>
  );
}
