"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@apollo/client/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { CreateTeamMutation } from "@/lib/graphql/operations/team-mutations.operations";

const schema = z.object({
  name: z.string().min(2, "At least 2 characters"),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, hyphens only"),
  logoUrl: z.string().url().or(z.literal("")).optional(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function NewTeamForm() {
  const router = useRouter();
  const toast = useToast();
  const [create, { error }] = useMutation(CreateTeamMutation);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    const r = await create({
      variables: {
        input: {
          name: values.name,
          slug: values.slug,
          logoUrl: values.logoUrl || null,
          description: values.description || null,
        },
      },
    });
    if (r.data?.createTeam) {
      toast.success(
        "New team created",
        `${r.data.createTeam.name} is ready — invite your first players.`,
      );
      router.push(`/teams/${r.data.createTeam.slug}/manage`);
      router.refresh();
    }
  });

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create a team</CardTitle>
          <p className="text-sm text-muted-foreground">
            You'll automatically be the captain.
          </p>
        </CardHeader>
        <CardContent>
          <form id="new-team" onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Team name</Label>
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
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                placeholder="kebab-case"
                invalid={!!errors.slug}
                {...register("slug")}
              />
              {errors.slug ? (
                <p className="text-xs text-destructive">
                  {errors.slug.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="logoUrl">Logo URL (optional)</Label>
              <Input
                id="logoUrl"
                placeholder="https://…"
                {...register("logoUrl")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description (optional)</Label>
              <Input id="description" {...register("description")} />
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error.message}
              </p>
            ) : null}
          </form>
        </CardContent>
        <CardFooter>
          <Button form="new-team" type="submit" loading={isSubmitting}>
            Create team
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
