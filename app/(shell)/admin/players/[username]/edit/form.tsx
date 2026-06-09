"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { AdminUpdateUserMutation } from "@/lib/graphql/operations/profile.operations";

const ROLES = [
  { value: "PLAYER", label: "Player" },
  { value: "TEAM_CAPTAIN", label: "Team captain" },
  { value: "ORGANIZER", label: "Organizer" },
  { value: "SUPER_ADMIN", label: "Super admin" },
  { value: "VIEWER", label: "Viewer (read-only)" },
];

export function AdminEditPlayerForm({
  user,
}: {
  user: {
    id: string;
    name: string;
    username: string;
    bio: string | null | undefined;
    nationality: string | null | undefined;
    role: string;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio ?? "");
  const [nationality, setNationality] = useState(user.nationality ?? "");
  const [role, setRole] = useState(user.role);
  const [save, { loading }] = useMutation(AdminUpdateUserMutation);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save({
        variables: {
          id: user.id,
          name,
          bio: bio || null,
          nationality: nationality || null,
          role,
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
        <Label htmlFor="adm-nat">Nationality (ISO-2)</Label>
        <Input
          id="adm-nat"
          value={nationality}
          onChange={(e) => setNationality(e.target.value.toUpperCase())}
          maxLength={2}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Role</Label>
        <Select value={role} onValueChange={setRole} options={ROLES} />
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
  );
}
