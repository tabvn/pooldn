"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@apollo/client/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUpload } from "@/components/ui/image-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CountrySelect } from "@/components/ui/country-select";
import { useToast } from "@/components/ui/toast";
import {
  UpdateProfileMutation,
  ViewerSettingsQuery,
} from "@/lib/graphql/operations/profile.operations";
import { ViewerQuery } from "@/lib/graphql/operations/competition.operations";

const schema = z.object({
  name: z.string().min(1, "Required"),
  bio: z.string().max(500, "Keep it under 500 characters").optional(),
  nationality: z.string().max(8, "Use a short code").optional(),
  cityId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function ProfileTab() {
  const router = useRouter();
  const toast = useToast();
  const { data, refetch } = useQuery(ViewerSettingsQuery);
  const [update, { loading: saving }] = useMutation(UpdateProfileMutation);

  const viewer = data?.viewer;
  const cities = data?.cities ?? [];

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", bio: "", nationality: "", cityId: "" },
  });

  useEffect(() => {
    if (!viewer) return;
    reset({
      name: viewer.name,
      bio: viewer.bio ?? "",
      nationality: viewer.nationality ?? "",
      cityId: viewer.city?.id ?? "",
    });
  }, [viewer, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await update({
        variables: {
          input: {
            name: values.name,
            bio: values.bio || null,
            nationality: values.nationality || null,
            cityId: values.cityId || null,
          },
        },
      });
      toast.success("Profile saved");
      await refetch();
      router.refresh();
    } catch (e) {
      toast.error(
        "Could not save",
        e instanceof Error ? e.message : undefined,
      );
    }
  });

  if (!viewer) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* Avatar — visual identity sits at the top so changes feel immediate. */}
      <Card>
        <CardHeader>
          <CardTitle>Photo</CardTitle>
        </CardHeader>
        <CardContent>
          <ImageUpload
            kind="avatar"
            ownerId={viewer.id}
            value={viewer.avatarUrl ?? null}
            fallback={viewer.name}
            onChange={async (url) => {
              // The upload route already persisted user.avatarUrl; this
              // mutation refreshes the Apollo cache + lets us refetch both
              // ViewerSettings (this page) and Viewer (the global header).
              await update({
                variables: { input: { avatarUrl: url || null } },
                refetchQueries: [
                  { query: ViewerSettingsQuery },
                  { query: ViewerQuery },
                ],
                awaitRefetchQueries: true,
              });
              toast.success(url ? "Photo updated" : "Photo removed");
              router.refresh();
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About you</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Display name</Label>
              <Input
                id="name"
                invalid={!!errors.name}
                {...register("name")}
              />
              {errors.name ? (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio</Label>
              <Input
                id="bio"
                placeholder="A short tagline shown on your profile"
                {...register("bio")}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Country Origin</Label>
                <Controller
                  control={control}
                  name="nationality"
                  render={({ field }) => (
                    <CountrySelect
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                    />
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Home city</Label>
                <Controller
                  control={control}
                  name="cityId"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      placeholder="— none —"
                      options={[
                        {
                          value: "",
                          label: (
                            <span className="text-muted-foreground">— none —</span>
                          ),
                        },
                        ...cities.map((c) => ({
                          value: c.id,
                          label: `${c.name}, ${c.country.name}`,
                        })),
                      ]}
                    />
                  )}
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                loading={isSubmitting || saving}
                disabled={!isDirty}
              >
                Save changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
