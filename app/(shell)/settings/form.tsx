"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@apollo/client/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUpload } from "@/components/ui/image-upload";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PageTitle } from "@/components/layout/page-title";
import {
  UpdateProfileMutation,
  ViewerSettingsQuery,
} from "@/lib/graphql/operations/profile.operations";

const schema = z.object({
  name: z.string().min(1, "Required"),
  bio: z.string().max(500, "Keep it under 500 characters").optional(),
  nationality: z
    .string()
    .max(8, "Use a short code or flag")
    .optional(),
  phone: z.string().optional(),
  avatarUrl: z
    .string()
    .url("Must be a URL")
    .or(z.literal(""))
    .optional(),
  cityId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function SettingsForm() {
  const router = useRouter();
  const { data, refetch } = useQuery(ViewerSettingsQuery);
  const [update, { error, loading: saving }] = useMutation(
    UpdateProfileMutation,
  );

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
    defaultValues: {
      name: "",
      bio: "",
      nationality: "",
      phone: "",
      avatarUrl: "",
      cityId: "",
    },
  });

  useEffect(() => {
    if (!viewer) return;
    reset({
      name: viewer.name,
      bio: viewer.bio ?? "",
      nationality: viewer.nationality ?? "",
      phone: "",
      avatarUrl: viewer.avatarUrl ?? "",
      cityId: viewer.city?.id ?? "",
    });
  }, [viewer, reset]);

  const onSubmit = handleSubmit(async (values) => {
    await update({
      variables: {
        input: {
          name: values.name,
          bio: values.bio || null,
          nationality: values.nationality || null,
          phone: values.phone || null,
          avatarUrl: values.avatarUrl || null,
          cityId: values.cityId || null,
        },
      },
    });
    await refetch();
    router.refresh();
  });

  if (!viewer) {
    return (
      <div className="p-8 text-sm text-muted-foreground">Loading…</div>
    );
  }

  return (
    <div className="flex flex-col">
      <PageTitle
        title="Settings"
        eyebrow={<span>Profile</span>}
        description="Update what other players see on your profile."
      />
      <div className="p-8 max-w-2xl">
        <Card>
          <CardHeader>
            <div className="space-y-4">
              <div>
                <CardTitle>{viewer.name}</CardTitle>
                <p className="text-sm text-muted-foreground">@{viewer.username}</p>
              </div>
              <ImageUpload
                kind="avatar"
                ownerId={viewer.id}
                value={viewer.avatarUrl ?? null}
                fallback={viewer.name}
                onChange={async (url) => {
                  // Persist via updateProfile so the server is the source of
                  // truth (the upload route also writes it best-effort).
                  await update({
                    variables: { input: { avatarUrl: url || null } },
                  });
                  await refetch();
                  router.refresh();
                }}
              />
            </div>
          </CardHeader>
          <CardContent>
            <form id="settings" onSubmit={onSubmit} className="space-y-4">
              <Field label="Display name" error={errors.name?.message}>
                <Input invalid={!!errors.name} {...register("name")} />
              </Field>
              <Field label="Bio (optional)" error={errors.bio?.message}>
                <Input
                  placeholder="Short tagline that shows on your profile"
                  {...register("bio")}
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field
                  label="Country code (optional)"
                  error={errors.nationality?.message}
                >
                  <Input
                    placeholder="e.g. VN or 🇻🇳"
                    {...register("nationality")}
                  />
                </Field>
                <Field label="Phone (optional)">
                  <Input placeholder="+84…" {...register("phone")} />
                </Field>
              </div>
              <Field
                label="Avatar URL (optional)"
                error={errors.avatarUrl?.message}
              >
                <Input
                  placeholder="https://…"
                  {...register("avatarUrl")}
                />
              </Field>
              <Field label="Home city (optional)">
                <Controller
                  control={control}
                  name="cityId"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      placeholder="— none —"
                      options={[
                        { value: "", label: <span className="text-muted-foreground">— none —</span> },
                        ...cities.map((c) => ({
                          value: c.id,
                          label: `${c.name}, ${c.country.name}`,
                        })),
                      ]}
                    />
                  )}
                />
              </Field>
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error.message}
                </p>
              ) : null}
            </form>
          </CardContent>
          <CardFooter>
            <Button
              form="settings"
              type="submit"
              loading={isSubmitting || saving}
              disabled={!isDirty}
            >
              Save changes
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </label>
  );
}
