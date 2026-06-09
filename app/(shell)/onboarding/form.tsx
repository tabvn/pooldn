"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client/react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUpload } from "@/components/ui/image-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageTitle } from "@/components/layout/page-title";
import { useToast } from "@/components/ui/toast";
import {
  UpdateProfileMutation,
  ViewerSettingsQuery,
} from "@/lib/graphql/operations/profile.operations";

/**
 * Round-12 TASK 4 — first-run player setup.
 *
 * Lightweight: avatar upload + city + nationality + bio. Pre-filled from
 * `ViewerSettingsQuery` so re-visiting just keeps editing. Submit calls
 * `updateProfile` and lands on the dashboard with a success toast.
 */
export function OnboardingForm({
  viewerId,
  viewerName,
}: {
  viewerId: string;
  viewerName: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const { data } = useQuery(ViewerSettingsQuery);
  const [update, { loading }] = useMutation(UpdateProfileMutation);
  const viewer = data?.viewer;
  const cities = data?.cities ?? [];
  const [name, setName] = useState(viewer?.name ?? viewerName);
  const [bio, setBio] = useState(viewer?.bio ?? "");
  const [nationality, setNationality] = useState(viewer?.nationality ?? "");
  const [cityId, setCityId] = useState(viewer?.city?.id ?? "");

  async function onSave(redirectTo: string) {
    try {
      await update({
        variables: {
          input: {
            name,
            bio: bio || null,
            nationality: nationality || null,
            cityId: cityId || null,
          },
        },
      });
      toast.success("Welcome to PoolDN!");
      router.push(redirectTo);
      router.refresh();
    } catch (e) {
      toast.error(
        "Could not save profile",
        e instanceof Error ? e.message : "Try again.",
      );
    }
  }

  return (
    <div className="flex flex-col">
      <PageTitle
        title="Set up your profile"
        eyebrow={<span>Welcome aboard</span>}
        description="A photo and a city help captains find you when they invite or build a roster."
      />
      <div className="p-8 max-w-2xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Profile photo</CardTitle>
          </CardHeader>
          <CardContent>
            <ImageUpload
              kind="avatar"
              ownerId={viewerId}
              shape="circle"
              fallback={name}
              value={viewer?.avatarUrl ?? null}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>About you</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Display name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="nationality">Nationality (2-letter code)</Label>
                <Input
                  id="nationality"
                  placeholder="VN"
                  maxLength={2}
                  value={nationality}
                  onChange={(e) =>
                    setNationality(e.target.value.toUpperCase())
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Home city</Label>
                <Select
                  value={cityId}
                  onValueChange={setCityId}
                  placeholder="— pick a city —"
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
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio</Label>
              <Input
                id="bio"
                placeholder="A short blurb teams will see"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <Avatar size="lg" src={viewer?.avatarUrl ?? null} fallback={name} />
            <div>
              <div className="text-sm font-semibold">{name || "—"}</div>
              <div className="text-xs text-muted-foreground">
                {nationality ? `${nationality} · ` : ""}
                {cities.find((c) => c.id === cityId)?.name ?? "no city"}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => router.push("/")}>
            Skip for now
          </Button>
          <Button loading={loading} onClick={() => onSave("/")}>
            Save and continue
          </Button>
        </div>
      </div>
    </div>
  );
}
