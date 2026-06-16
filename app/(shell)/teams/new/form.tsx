"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@apollo/client/react";
import { Check, Plus, Sparkles, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImageUpload } from "@/components/ui/image-upload";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  CitiesQuery,
  ViewerQuery,
} from "@/lib/graphql/operations/competition.operations";
import { UsersDirectoryQuery } from "@/lib/graphql/operations/team-mutations.operations";
import { CreateTeamMutation } from "@/lib/graphql/operations/team-mutations.operations";
import { UpdateTeamMutation } from "@/lib/graphql/operations/team-mutations.operations";

const STEPS = [
  { title: "Basics", desc: "Name your team, pick a city, write a short bio." },
  { title: "Invite members", desc: "Queue invitations to bring your crew on board." },
  { title: "Review & create", desc: "Take one last look before we lock it in." },
  { title: "Done", desc: "You're rolling. Add a logo and head to your team page." },
] as const;

type StepIndex = 0 | 1 | 2 | 3;

const basicsSchema = z.object({
  name: z.string().min(2, "At least 2 characters"),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, hyphens only"),
  description: z.string().optional(),
  cityId: z.string().optional(),
});
type BasicsValues = z.infer<typeof basicsSchema>;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function NewTeamForm() {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState<StepIndex>(0);
  // R43 #3 — captain uploads the logo in Step 1 via the team-logo-draft
  // upload kind (keyed to viewer.id). createTeam adopts the URL into
  // team.logoUrl on submission, so the team page already has it when the
  // Done step opens.
  const [draftLogoUrl, setDraftLogoUrl] = useState<string | null>(null);
  const [invites, setInvites] = useState<
    Array<
      | { kind: "user"; userId: string; name: string; username: string; avatarUrl?: string | null }
      | { kind: "email"; email: string }
    >
  >([]);
  const [created, setCreated] = useState<{
    id: string;
    slug: string;
    name: string;
    logoUrl: string | null;
  } | null>(null);

  const [create, { loading: creating }] = useMutation(CreateTeamMutation);
  const [updateTeam] = useMutation(UpdateTeamMutation);
  const citiesQuery = useQuery(CitiesQuery);
  const cities = citiesQuery.data?.cities ?? [];

  const form = useForm<BasicsValues>({
    resolver: zodResolver(basicsSchema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      cityId: "",
    },
  });
  const {
    register,
    handleSubmit,
    control,
    trigger,
    watch,
    setValue,
    formState: { errors },
  } = form;

  // Slug auto-derive from name until user edits the slug field.
  const slugTouchedRef = useRef(false);
  const watchedName = watch("name");
  const watchedSlug = watch("slug");
  useEffect(() => {
    if (slugTouchedRef.current) return;
    const derived = slugify(watchedName);
    if (derived && derived !== watchedSlug) {
      setValue("slug", derived, { shouldValidate: false });
    }
  }, [watchedName, watchedSlug, setValue]);

  async function goNext() {
    if (step === 0) {
      const ok = await trigger(["name", "slug", "description", "cityId"], {
        shouldFocus: true,
      });
      if (!ok) return;
    }
    setStep((s) => (Math.min(s + 1, 3) as StepIndex));
  }
  function goPrev() {
    setStep((s) => (Math.max(s - 1, 0) as StepIndex));
  }

  const submit = handleSubmit(async (values) => {
    if (step !== 2) return; // only the Review step submits
    try {
      const inviteTokens: string[] = invites.map((i) =>
        i.kind === "user" ? i.username : i.email,
      );
      const r = await create({
        variables: {
          input: {
            name: values.name,
            slug: values.slug,
            description: values.description || null,
            cityId: values.cityId || null,
            logoUrl: draftLogoUrl,
            invites: inviteTokens,
          },
        },
      });
      if (!r.data?.createTeam) return;
      const t = r.data.createTeam;
      setCreated({
        id: t.id,
        slug: t.slug,
        name: t.name,
        logoUrl: t.logoUrl ?? null,
      });
      toast.success(
        `${t.name} created`,
        invites.length
          ? `${invites.length} invite${invites.length === 1 ? "" : "s"} sent.`
          : "You're the captain — invite some players when you're ready.",
      );
      setStep(3);
    } catch (e) {
      toast.error("Could not create team", e);
    }
  });

  return (
    <div className="min-h-full">
      <header
        className="px-4 py-6 md:px-8 md:py-8"
        style={{
          background:
            "linear-gradient(135deg, #d0f30d 0%, #c4e60d 60%, #a9c80a 100%)",
        }}
      >
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-black/60">
                Create team
              </p>
              <h1 className="text-3xl font-black text-black mt-1">
                Step {step + 1} · {STEPS[step].title}
              </h1>
              <p className="text-sm text-black/70 mt-1">{STEPS[step].desc}</p>
            </div>
            <span className="rounded-full bg-black/15 px-3 py-1 text-xs font-bold text-black">
              {step + 1} / {STEPS.length}
            </span>
          </div>
          <ol className="flex items-center gap-2" aria-label="Wizard progress">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex-1">
                <button
                  type="button"
                  onClick={() => i < step && setStep(i as StepIndex)}
                  disabled={i > step}
                  className={
                    "block w-full h-1.5 rounded-full transition-colors " +
                    (i <= step ? "bg-black" : "bg-black/20")
                  }
                  aria-label={`Step ${i + 1}: ${s.title}`}
                />
              </li>
            ))}
          </ol>
        </div>
      </header>

      <form
        id="new-team"
        onSubmit={submit}
        className="px-8 py-8 max-w-3xl mx-auto space-y-6"
        // Block Enter from leapfrogging steps.
        onKeyDown={(e) => {
          if (e.key === "Enter" && step !== 2) {
            const target = e.target as HTMLElement;
            if (target.tagName !== "TEXTAREA") e.preventDefault();
          }
        }}
      >
        {step === 0 ? (
          <BasicsStep
            register={register}
            errors={errors}
            control={control}
            cities={cities}
            draftLogoUrl={draftLogoUrl}
            onLogoChange={setDraftLogoUrl}
            onSlugEdit={() => {
              slugTouchedRef.current = true;
            }}
          />
        ) : null}

        {step === 1 ? (
          <InvitesStep invites={invites} setInvites={setInvites} />
        ) : null}

        {step === 2 ? (
          <ReviewStep
            values={watch()}
            invites={invites}
            cities={cities}
            onEdit={(s) => setStep(s)}
          />
        ) : null}

        {step === 3 && created ? (
          <DoneStep
            team={created}
            onLogoSaved={async (url) => {
              try {
                await updateTeam({
                  variables: { id: created.id, input: { logoUrl: url } },
                });
                setCreated({ ...created, logoUrl: url });
              } catch (e) {
                toast.error("Could not save logo", e);
              }
            }}
            onFinish={() => {
              router.push(`/teams/${created.slug}`);
              router.refresh();
            }}
          />
        ) : null}

        {step < 3 ? (
          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={goPrev}
              disabled={step === 0}
            >
              Back
            </Button>
            {step === 2 ? (
              <Button
                type="submit"
                loading={creating}
                data-testid="create-team-submit"
              >
                Create team
              </Button>
            ) : (
              <Button type="button" onClick={goNext} data-testid="wizard-next">
                Next
              </Button>
            )}
          </div>
        ) : null}
      </form>
    </div>
  );
}

function BasicsStep({
  register,
  errors,
  control,
  cities,
  draftLogoUrl,
  onLogoChange,
  onSlugEdit,
}: {
  register: ReturnType<typeof useForm<BasicsValues>>["register"];
  errors: ReturnType<typeof useForm<BasicsValues>>["formState"]["errors"];
  control: ReturnType<typeof useForm<BasicsValues>>["control"];
  cities: Array<{ id: string; name: string }>;
  draftLogoUrl: string | null;
  onLogoChange: (url: string | null) => void;
  onSlugEdit: () => void;
}) {
  const viewerQuery = useQuery(ViewerQuery, { errorPolicy: "ignore" });
  const viewerId = viewerQuery.data?.viewer?.id ?? null;
  return (
    <div className="space-y-4">
      <Field label="Team logo">
        {viewerId ? (
          <div className="flex items-start gap-4">
            <ImageUpload
              kind="team-logo-draft"
              ownerId={viewerId}
              value={draftLogoUrl}
              fallback="Logo"
              shape="square"
              onChange={(url) => onLogoChange(url)}
            />
            <p className="text-xs text-muted-foreground max-w-xs leading-snug">
              Drop a PNG / JPG / WebP. You'll be able to zoom, pan, and reframe
              it in the crop modal. Optional — you can add one later.
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Sign in to upload a logo.
          </p>
        )}
      </Field>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Team name" error={errors.name?.message}>
          <Input
            invalid={!!errors.name}
            placeholder="The Cue Crew"
            data-testid="team-name"
            {...register("name")}
          />
        </Field>
        <Field
          label="Slug"
          hint="Auto-generated from the name. Edit to override."
          error={errors.slug?.message}
        >
          <Input
            placeholder="the-cue-crew"
            invalid={!!errors.slug}
            data-testid="team-slug"
            {...register("slug", { onChange: onSlugEdit })}
          />
        </Field>
      </div>
      <Field label="Description (optional)">
        <Input
          placeholder="Tell people what your team is about."
          {...register("description")}
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
              options={[
                { value: "", label: "— none —" },
                ...cities.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          )}
        />
      </Field>
    </div>
  );
}

function InvitesStep({
  invites,
  setInvites,
}: {
  invites: Array<
    | { kind: "user"; userId: string; name: string; username: string; avatarUrl?: string | null }
    | { kind: "email"; email: string }
  >;
  setInvites: (
    next: Array<
      | { kind: "user"; userId: string; name: string; username: string; avatarUrl?: string | null }
      | { kind: "email"; email: string }
    >,
  ) => void;
}) {
  const [q, setQ] = useState("");
  const { data } = useQuery(UsersDirectoryQuery);
  const users = data?.users ?? [];

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return users
      .filter(
        (u) =>
          u.name.toLowerCase().includes(t) ||
          u.username.toLowerCase().includes(t),
      )
      .slice(0, 8);
  }, [users, q]);

  function add(user: {
    id: string;
    name: string;
    username: string;
    avatarUrl?: string | null;
  }) {
    if (invites.some((i) => i.kind === "user" && i.userId === user.id)) return;
    setInvites([
      ...invites,
      {
        kind: "user",
        userId: user.id,
        name: user.name,
        username: user.username,
        avatarUrl: user.avatarUrl,
      },
    ]);
    setQ("");
  }

  function addEmail() {
    const email = q.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (invites.some((i) => i.kind === "email" && i.email === email)) return;
    setInvites([...invites, { kind: "email", email }]);
    setQ("");
  }

  function remove(idx: number) {
    setInvites(invites.filter((_, i) => i !== idx));
  }

  const isEmailLike = /@/.test(q.trim());

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3">
          <Field
            label="Add players by name, username, or email"
            hint="Skip this step if you'd rather invite later from the Manage players page."
          >
            <div className="relative">
              <Input
                placeholder="Search players or paste an email"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (isEmailLike) addEmail();
                  }
                }}
                data-testid="invite-search"
              />
              {matches.length > 0 ? (
                <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                  {matches.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-secondary/60"
                        onClick={() => add(u)}
                        data-testid={`invite-add-${u.username}`}
                      >
                        <Avatar size="sm" src={u.avatarUrl ?? undefined} fallback={u.name} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold">{u.name}</div>
                          <div className="text-xs text-muted-foreground">
                            @{u.username}
                          </div>
                        </div>
                        <Plus className="size-4 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Field>
          {isEmailLike ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addEmail}
              data-testid="invite-add-email"
            >
              <Plus className="size-3.5" /> Invite {q.trim()}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Queued invitations</h3>
          <Badge variant="neutral" size="sm">
            {invites.length}
          </Badge>
        </div>
        {invites.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            No invites queued yet. You can always invite players later.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2" data-testid="invite-list">
            {invites.map((i, idx) => (
              <li
                key={idx}
                className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {i.kind === "user" ? (
                  <>
                    <Avatar
                      size="sm"
                      src={i.avatarUrl ?? undefined}
                      fallback={i.name}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{i.name}</div>
                      <div className="text-xs text-muted-foreground">
                        @{i.username}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <Avatar size="sm" fallback="@" />
                    <div className="min-w-0 flex-1 truncate text-sm">{i.email}</div>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove invite"
                  data-testid={`invite-remove-${idx}`}
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ReviewStep({
  values,
  invites,
  cities,
  onEdit,
}: {
  values: BasicsValues;
  invites: Array<
    | { kind: "user"; userId: string; name: string; username: string; avatarUrl?: string | null }
    | { kind: "email"; email: string }
  >;
  cities: Array<{ id: string; name: string }>;
  onEdit: (step: StepIndex) => void;
}) {
  const city = cities.find((c) => c.id === values.cityId);
  return (
    <div className="space-y-4">
      <ReviewGroup title="Basics" onEdit={() => onEdit(0)}>
        <Row label="Name" value={values.name || "—"} />
        <Row label="Slug" value={`/teams/${values.slug || "—"}`} />
        <Row label="City" value={city?.name ?? "—"} />
        <Row label="Description" value={values.description || "—"} />
      </ReviewGroup>
      <ReviewGroup title="Invites" onEdit={() => onEdit(1)}>
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No invitations queued — invite people later from Manage players.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {invites.map((i, idx) => (
              <li key={idx} className="text-sm">
                {i.kind === "user" ? (
                  <span>
                    {i.name}{" "}
                    <span className="text-muted-foreground">@{i.username}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">{i.email}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </ReviewGroup>
    </div>
  );
}

function DoneStep({
  team,
  onLogoSaved,
  onFinish,
}: {
  team: { id: string; slug: string; name: string; logoUrl: string | null };
  onLogoSaved: (url: string) => Promise<void>;
  onFinish: () => void;
}) {
  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-success/20 text-success">
        <Sparkles className="size-7" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-2xl font-bold">{team.name} is live!</h2>
        <p className="text-sm text-muted-foreground">
          You're the captain. Add a logo, then head to your team page.
        </p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Team logo
          </p>
          <ImageUpload
            kind="team-logo"
            ownerId={team.id}
            shape="square"
            value={team.logoUrl}
            fallback={team.name}
            onChange={onLogoSaved}
          />
        </CardContent>
      </Card>
      <div className="flex items-center justify-center gap-2">
        <Button type="button" onClick={onFinish} data-testid="wizard-finish">
          <Check className="size-4" /> Go to team page
        </Button>
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
      <span className="block text-sm font-medium">{label}</span>
      {children}
      {hint && !error ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </label>
  );
}

function ReviewGroup({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onEdit}
        >
          Edit
        </Button>
      </div>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/50 py-1.5 text-sm last:border-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
