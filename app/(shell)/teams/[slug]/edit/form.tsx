"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUpload } from "@/components/ui/image-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageTitle } from "@/components/layout/page-title";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  DeleteTeamMutation,
  UpdateTeamMutation,
} from "@/lib/graphql/operations/team-mutations.operations";

export function EditTeamForm({
  initial,
}: {
  initial: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    logoUrl: string | null;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [update, { loading: saving }] = useMutation(UpdateTeamMutation);
  const [del, { loading: deleting }] = useMutation(DeleteTeamMutation);

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logoUrl);

  async function onSave() {
    try {
      await update({
        variables: {
          id: initial.id,
          input: {
            name,
            description: description || null,
            logoUrl: logoUrl || null,
          },
        },
      });
      toast.success("Team saved");
      router.push(`/teams/${initial.slug}`);
      router.refresh();
    } catch (e) {
      toast.error(
        "Could not save team",
        e instanceof Error ? e.message : undefined,
      );
    }
  }

  async function onDelete() {
    const ok = await confirm({
      title: `Delete "${initial.name}"?`,
      description:
        "The team is deactivated. Existing match history and applications stay.",
      confirmLabel: "Delete team",
      destructive: true,
    });
    if (!ok) return;
    try {
      await del({ variables: { id: initial.id } });
      toast.success("Team deleted");
      router.push("/teams");
      router.refresh();
    } catch (e) {
      toast.error(
        "Could not delete",
        e instanceof Error ? e.message : undefined,
      );
    }
  }

  return (
    <div className="flex flex-col">
      <PageTitle
        title={`Edit ${initial.name}`}
        eyebrow={<span>Team settings</span>}
      />
      <div className="p-8 max-w-2xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Logo</CardTitle>
          </CardHeader>
          <CardContent>
            <ImageUpload
              kind="team-logo"
              ownerId={initial.id}
              value={logoUrl}
              fallback={name}
              shape="square"
              onChange={(url) => setLogoUrl(url || null)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team details</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                onSave();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="name">Team name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="A short blurb about the team"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onDelete}
                  loading={deleting}
                  className="text-destructive hover:text-destructive"
                >
                  Delete team
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => router.push(`/teams/${initial.slug}`)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" loading={saving}>
                    Save changes
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
