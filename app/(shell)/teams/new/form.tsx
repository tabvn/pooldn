"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@apollo/client/react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ViewerQuery } from "@/lib/graphql/operations/competition.operations";
import { VenuesListQuery } from "@/lib/graphql/operations/venue.operations";
import { CreateTeamMutation } from "@/lib/graphql/operations/team-mutations.operations";

const schema = z.object({
  name: z.string().min(2, "At least 2 characters"),
  description: z.string().optional(),
  homeVenueId: z.string().optional(),
});
type Values = z.infer<typeof schema>;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/**
 * Round-64 — single-screen Create Team form (Figma node 53:2911). No wizard:
 * submit creates the team and lands on its detail page. Home city is taken
 * from the header location selector (passed in as `cityId`/`cityName`), not a
 * form field — you create teams in the city you're browsing.
 */
export function NewTeamForm({
  cityId,
  cityName,
}: {
  cityId: string | null;
  cityName: string | null;
}) {
  const router = useRouter();
  const toast = useToast();

  const viewerQuery = useQuery(ViewerQuery, { errorPolicy: "ignore" });
  const viewerId = viewerQuery.data?.viewer?.id ?? null;
  const [draftLogoUrl, setDraftLogoUrl] = useState<string | null>(null);

  const venuesQuery = useQuery(VenuesListQuery, {
    variables: { cityId },
    skip: !cityId,
  });
  const venues = (venuesQuery.data?.venues ?? []).filter((v) => v.isActive);

  const [create, { loading: creating }] = useMutation(CreateTeamMutation);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { name: "", description: "", homeVenueId: "" },
  });
  const homeVenueId = watch("homeVenueId");

  const submit = handleSubmit(async (values) => {
    try {
      const r = await create({
        variables: {
          input: {
            name: values.name,
            slug: slugify(values.name),
            description: values.description || null,
            cityId: cityId || null,
            homeVenueId: values.homeVenueId || null,
            logoUrl: draftLogoUrl,
            invites: [],
          },
        },
      });
      const t = r.data?.createTeam;
      if (!t) return;
      toast.success(
        `${t.name} created`,
        "You're the captain — invite players from your team page.",
      );
      router.push(`/teams/${t.slug}`);
      router.refresh();
    } catch (e) {
      toast.error("Could not create team", e);
    }
  });

  return (
    <div className="flex flex-col">
      {/* Lime-tinted page title band (Figma PageTitle). */}
      <div className="bg-primary/10 px-6 py-10 md:px-10">
        <div className="mx-auto w-full max-w-5xl">
          <h1 className="text-[28px] font-semibold leading-[34px] text-primary">
            Create Team
          </h1>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl px-6 pt-10 md:px-10">
        <div className="rounded-[10px] border border-border bg-card p-5">
          <form onSubmit={submit} className="mx-auto w-full max-w-[480px] space-y-4">
            <Field label="Team Name" error={errors.name?.message}>
              <Input
                invalid={!!errors.name}
                placeholder="e.g. The Hustlers"
                data-testid="team-name"
                {...register("name")}
              />
            </Field>

            <Field label="Description (optional)">
              <textarea
                rows={4}
                placeholder="Describe your team..."
                className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring"
                {...register("description")}
              />
            </Field>

            {/* Home city is fixed to the header's active city. */}
            <Field
              label="Home City"
              hint="Set from your location selector in the header."
            >
              <div
                data-testid="home-city"
                className="flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background/50 px-3 text-sm text-muted-foreground"
              >
                <MapPin className="size-4 shrink-0" />
                {cityName ?? "No city selected"}
              </div>
            </Field>

            <Field label="Home Venue (optional)">
              <Select
                value={homeVenueId ?? ""}
                onValueChange={(v) =>
                  setValue("homeVenueId", v, { shouldDirty: true })
                }
                placeholder={
                  cityId ? "Enter or search venue name" : "Pick a city first"
                }
                disabled={!cityId || venues.length === 0}
                options={[
                  { value: "", label: "No home venue" },
                  ...venues.map((v) => ({ value: v.id, label: v.name })),
                ]}
              />
            </Field>

            <Field label="Team Logo (optional)">
              {viewerId ? (
                <ImageUpload
                  kind="team-logo-draft"
                  ownerId={viewerId}
                  value={draftLogoUrl}
                  fallback="Logo"
                  shape="square"
                  onChange={setDraftLogoUrl}
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Sign in to upload a logo.
                </p>
              )}
            </Field>

            {/* Team Info helper (Figma sky-tinted callout). */}
            <div className="rounded-lg border border-[#00598a] bg-[#052f4a] p-3 text-[#dff2fe]">
              <p className="text-base font-semibold leading-6">Team Info</p>
              <ul className="ml-5 list-disc text-sm leading-5">
                <li>You will be the team captain</li>
                <li>Invite players to join your team</li>
                <li>Compete in team tournaments</li>
              </ul>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                className="border-primary/50 text-primary hover:bg-primary/10"
                onClick={() => router.push("/teams")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={creating}
                data-testid="create-team-submit"
              >
                Create Team
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block py-1 text-base font-semibold text-white/70">
        {label}
      </span>
      {children}
      {hint && !error ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </label>
  );
}
