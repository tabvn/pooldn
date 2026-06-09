"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import { ImageUpload } from "@/components/ui/image-upload";
import { useToast } from "@/components/ui/toast";
import { UpdateCompetitionMutation } from "@/lib/graphql/operations/competition-mutations.operations";

type Props = {
  competitionId: string;
  name: string;
  bannerUrl: string | null;
};

export function CompetitionBannerUpload({
  competitionId,
  name,
  bannerUrl,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [update] = useMutation(UpdateCompetitionMutation);

  return (
    <ImageUpload
      kind="competition-banner"
      ownerId={competitionId}
      shape="wide"
      fallback={name}
      value={bannerUrl}
      onChange={async (url) => {
        // The upload route already persisted competition.bannerUrl on upload;
        // this mutation handles the remove case (url === "") and keeps Apollo
        // in sync after either operation.
        try {
          await update({
            variables: {
              id: competitionId,
              input: { bannerUrl: url || null },
            },
          });
          toast.success(url ? "Banner updated" : "Banner removed");
          router.refresh();
        } catch (e) {
          toast.error(
            "Update failed",
            e instanceof Error ? e.message : "Try again.",
          );
        }
      }}
    />
  );
}
