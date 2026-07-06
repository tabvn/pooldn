"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUpload } from "@/components/ui/image-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CountrySelect } from "@/components/ui/country-select";
import { useToast } from "@/components/ui/toast";
import { AdminUpdateUserMutation } from "@/lib/graphql/operations/profile.operations";

export function AdminEditPlayerForm({
  user,
}: {
  user: {
    id: string;
    name: string;
    username: string;
    bio: string | null | undefined;
    nationality: string | null | undefined;
    avatarUrl: string | null | undefined;
    role: string;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio ?? "");
  const [nationality, setNationality] = useState(user.nationality ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    user.avatarUrl ?? null,
  );
  const [save, { loading }] = useMutation(AdminUpdateUserMutation);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      // Role is no longer editable here — everyone is a Player. Pass the
      // existing role through unchanged so we never wipe it.
      await save({
        variables: {
          id: user.id,
          name,
          bio: bio || null,
          nationality: nationality || null,
          role: user.role,
        },
      });
      toast.success("Player updated");
      router.push(`/players/${user.username}`);
      router.refresh();
    } catch (err) {
      toast.error("Could not update player", err);
    }
  }

  return (
    <div className="space-y-4">
      {/* Photo — same uploader (crop modal) as the team logo / self profile. */}
      <Card>
        <CardHeader>
          <CardTitle>Photo</CardTitle>
        </CardHeader>
        <CardContent>
          <ImageUpload
            kind="avatar"
            ownerId={user.id}
            value={avatarUrl}
            fallback={name}
            onChange={(url) => {
              setAvatarUrl(url || null);
              router.refresh();
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Player details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="adm-name">Name</Label>
              <Input
                id="adm-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adm-bio">Bio</Label>
              <Input
                id="adm-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Country Origin</Label>
              <CountrySelect value={nationality} onValueChange={setNationality} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push(`/players/${user.username}`)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={loading} data-testid="admin-save-player">
                Save
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
