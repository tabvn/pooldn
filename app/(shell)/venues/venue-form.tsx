"use client";

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
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { CitiesQuery } from "@/lib/graphql/operations/competition.operations";
import {
  CreateVenueMutation,
  DeleteVenueMutation,
  UpdateVenueMutation,
} from "@/lib/graphql/operations/venue-mutations.operations";

const schema = z.object({
  name: z.string().min(2, "At least 2 characters"),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, hyphens only"),
  address: z.string().min(2, "Required"),
  cityId: z.string().min(1, "Pick a city"),
  phone: z.string().optional(),
  email: z.string().email().or(z.literal("")).optional(),
  website: z.string().url().or(z.literal("")).optional(),
  tableCount: z.coerce.number().int().min(0).optional(),
  imageUrl: z.string().optional(),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

type Mode =
  | { kind: "create" }
  | {
      kind: "edit";
      venue: {
        id: string;
        slug: string;
        name: string;
        address: string;
        phone?: string | null;
        email?: string | null;
        website?: string | null;
        tableCount?: number | null;
        imageUrl?: string | null;
        city: { id: string };
      };
    };

export function VenueForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const citiesQuery = useQuery(CitiesQuery);
  const cities = citiesQuery.data?.cities ?? [];
  const [create] = useMutation(CreateVenueMutation);
  const [update] = useMutation(UpdateVenueMutation);
  const [del, delState] = useMutation(DeleteVenueMutation);

  const isEdit = mode.kind === "edit";
  const initial = isEdit ? mode.venue : null;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      slug: initial?.slug ?? "",
      address: initial?.address ?? "",
      cityId: initial?.city.id ?? "",
      phone: initial?.phone ?? "",
      email: initial?.email ?? "",
      website: initial?.website ?? "",
      tableCount: initial?.tableCount ?? undefined,
      imageUrl: initial?.imageUrl ?? "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEdit) {
        const r = await update({
          variables: {
            id: initial!.id,
            input: {
              name: values.name,
              address: values.address,
              cityId: values.cityId,
              phone: values.phone || null,
              email: values.email || null,
              website: values.website || null,
              tableCount: values.tableCount ?? null,
              imageUrl: values.imageUrl || null,
            },
          },
        });
        if (r.data?.updateVenue) {
          toast.success("Venue updated");
          router.push(`/venues/${r.data.updateVenue.slug}`);
          router.refresh();
        }
      } else {
        const r = await create({
          variables: {
            input: {
              name: values.name,
              slug: values.slug,
              address: values.address,
              cityId: values.cityId,
              phone: values.phone || null,
              email: values.email || null,
              website: values.website || null,
              tableCount: values.tableCount ?? null,
              imageUrl: values.imageUrl || null,
            },
          },
        });
        if (r.data?.createVenue) {
          toast.success(`${r.data.createVenue.name} created`);
          router.push(`/venues/${r.data.createVenue.slug}`);
          router.refresh();
        }
      }
    } catch (e) {
      toast.error(
        "Could not save venue",
        e instanceof Error ? e.message : undefined,
      );
    }
  });

  async function onDelete() {
    if (!isEdit) return;
    const ok = await confirm({
      title: `Delete "${initial!.name}"?`,
      description:
        "This deactivates the venue; matches already hosted there are preserved.",
      confirmLabel: "Delete venue",
      destructive: true,
    });
    if (!ok) return;
    await del({ variables: { id: initial!.id } });
    toast.success("Venue deleted");
    router.push("/venues");
    router.refresh();
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>
            {isEdit ? `Edit ${initial!.name}` : "New venue"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form id="venue-form" onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">
                Venue image
              </label>
              <Controller
                control={control}
                name="imageUrl"
                render={({ field }) => (
                  <ImageUpload
                    kind="venue-image"
                    ownerId={initial?.id ?? "pending"}
                    value={field.value || null}
                    fallback={watch("name") || "Venue"}
                    shape="wide"
                    disabled={!isEdit}
                    onChange={(url) => {
                      setValue("imageUrl", url, { shouldDirty: true });
                    }}
                  />
                )}
              />
              {!isEdit ? (
                <p className="text-xs text-muted-foreground mt-2">
                  Save the venue first, then upload an image.
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Name" error={errors.name?.message}>
                <Input invalid={!!errors.name} {...register("name")} />
              </Field>
              <Field label="Slug" error={errors.slug?.message}>
                <Input
                  placeholder="kebab-case"
                  invalid={!!errors.slug}
                  disabled={isEdit}
                  {...register("slug")}
                />
              </Field>
            </div>

            <Field label="Address" error={errors.address?.message}>
              <Input invalid={!!errors.address} {...register("address")} />
            </Field>

            <Field label="City" error={errors.cityId?.message}>
              <Controller
                control={control}
                name="cityId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="Pick a city"
                    options={cities.map((c) => ({
                      value: c.id,
                      label: `${c.name}, ${c.country.name}`,
                    }))}
                  />
                )}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Phone (optional)">
                <Input placeholder="+84…" {...register("phone")} />
              </Field>
              <Field label="Email (optional)" error={errors.email?.message}>
                <Input
                  type="email"
                  placeholder="hello@venue.com"
                  invalid={!!errors.email}
                  {...register("email")}
                />
              </Field>
              <Field label="Website (optional)" error={errors.website?.message}>
                <Input
                  type="url"
                  placeholder="https://"
                  invalid={!!errors.website}
                  {...register("website")}
                />
              </Field>
            </div>

            <Field label="Table count (optional)">
              <Input
                type="number"
                min={0}
                {...register("tableCount")}
              />
            </Field>
          </form>
        </CardContent>
        <CardFooter className="justify-between">
          {isEdit ? (
            <Button
              type="button"
              variant="danger"
              loading={delState.loading}
              onClick={onDelete}
            >
              Delete venue
            </Button>
          ) : (
            <span />
          )}
          <Button form="venue-form" type="submit" loading={isSubmitting}>
            {isEdit ? "Save changes" : "Create venue"}
          </Button>
        </CardFooter>
      </Card>
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
