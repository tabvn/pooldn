import { Lightbulb } from "lucide-react";
import { PageTitle } from "@/components/layout/page-title";
import { FeedbackForm } from "./form";

export default function FeedbackPage() {
  return (
    <div className="flex flex-col">
      <PageTitle
        title="Suggest a Feature"
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <Lightbulb className="size-3.5" /> Feedback
          </span>
        }
        description="Tell us what's missing or broken. Admins are notified directly."
      />
      <div className="p-8 max-w-2xl">
        <FeedbackForm />
      </div>
    </div>
  );
}
