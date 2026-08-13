import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getClient } from "@/lib/apollo/client";
import { ViewerQuery } from "@/lib/graphql/operations/competition.operations";
import { ClaimPreviewQuery } from "@/lib/graphql/operations/claim.operations";
import { ClaimForm } from "./claim-form";

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const client = getClient();
  const [{ data }, viewerResult] = await Promise.all([
    client.query({
      query: ClaimPreviewQuery,
      variables: { token },
      errorPolicy: "ignore",
    }),
    client.query({ query: ViewerQuery, errorPolicy: "ignore" }),
  ]);
  const preview = data?.claimPreview ?? null;
  const viewer = viewerResult.data?.viewer ?? null;

  if (!preview) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center">
          <AlertTriangle className="size-8 text-warning" />
          <h1 className="text-lg font-semibold">This claim link isn&apos;t valid</h1>
          <p className="text-sm text-muted-foreground">
            It may have expired, already been used, or been mistyped. Ask the
            league organizer for a fresh link.
          </p>
          <Link
            href="/"
            className="mt-2 text-sm font-semibold text-primary hover:underline"
          >
            Go home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ClaimForm
      token={token}
      preview={preview}
      signedInName={viewer?.name ?? null}
    />
  );
}
