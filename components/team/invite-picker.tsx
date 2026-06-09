"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery } from "@apollo/client/react";
import { Mail, Search, UserPlus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UsersDirectoryQuery } from "@/lib/graphql/operations/team-mutations.operations";

type ExcludeSet = ReadonlySet<string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Searchable invite picker.
 *
 *   - Captain types a name or username — the picker filters the user
 *     directory and renders up to 6 matches in a dropdown.
 *   - Users already on the team or already invited are filtered out so the
 *     captain can't double-invite.
 *   - Email fallback: if no users match AND the input looks like a valid
 *     email, the captain can still send an email-based invitation.
 *   - Esc + outside-click dismiss the dropdown; ArrowDown / Up / Enter for
 *     keyboard navigation.
 */
export function InvitePicker({
  excludeUserIds,
  loading,
  onSubmit,
}: {
  excludeUserIds: ExcludeSet;
  loading: boolean;
  /**
   * Caller persists the invitation. Returns true on success so the picker
   * can clear its input + dropdown.
   */
  onSubmit: (
    input: { kind: "user"; userId: string; label: string } | { kind: "email"; email: string },
  ) => Promise<boolean>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const { data } = useQuery(UsersDirectoryQuery);

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/^@/, "");
    if (needle.length < 1) return [];
    return (data?.users ?? [])
      .filter(
        (u) =>
          !excludeUserIds.has(u.id) &&
          (u.name.toLowerCase().includes(needle) ||
            u.username.toLowerCase().includes(needle)),
      )
      .slice(0, 6);
  }, [data, q, excludeUserIds]);

  const trimmed = q.trim();
  const looksLikeEmail = EMAIL_RE.test(trimmed);
  const canSendEmail = looksLikeEmail && matches.length === 0;

  async function pickUser(user: { id: string; name: string; username: string }) {
    const ok = await onSubmit({
      kind: "user",
      userId: user.id,
      label: `${user.name} (@${user.username})`,
    });
    if (ok) {
      setQ("");
      setOpen(false);
    }
  }

  async function sendEmail() {
    const ok = await onSubmit({ kind: "email", email: trimmed.toLowerCase() });
    if (ok) {
      setQ("");
      setOpen(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(matches.length - 1, 0)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (matches.length > 0 && matches[activeIdx]) {
        void pickUser(matches[activeIdx]);
      } else if (canSendEmail) {
        void sendEmail();
      }
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActiveIdx(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Delay so onClick on a dropdown item still fires before close.
            setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={onKey}
          placeholder="Search by name, @username, or paste an email"
          className="pl-8"
          data-testid="invite-picker-input"
        />
      </div>
      {open && (matches.length > 0 || canSendEmail) ? (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-30 max-h-72 overflow-auto rounded-md border border-border bg-card shadow-lg"
          data-testid="invite-picker-dropdown"
          role="listbox"
        >
          {matches.length > 0 ? (
            <ul>
              {matches.map((u, i) => {
                const active = i === activeIdx;
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIdx(i)}
                      onMouseDown={(e) => {
                        // Prevent the input's onBlur from racing the click.
                        e.preventDefault();
                      }}
                      onClick={() => pickUser(u)}
                      role="option"
                      aria-selected={active}
                      disabled={loading}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                        active ? "bg-secondary/60" : ""
                      }`}
                      data-testid={`invite-pick-${u.username}`}
                    >
                      <Avatar
                        size="sm"
                        src={u.avatarUrl ?? undefined}
                        fallback={u.name}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{u.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          @{u.username}
                          {u.role ? ` · ${u.role.toLowerCase()}` : ""}
                        </div>
                      </div>
                      <UserPlus className="size-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {canSendEmail ? (
            <div className="border-t border-border">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void sendEmail()}
                disabled={loading}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary/60"
                data-testid="invite-send-email"
              >
                <Mail className="size-3.5 text-muted-foreground" />
                <span className="flex-1 truncate">
                  Send email invite to <strong>{trimmed}</strong>
                </span>
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {open && q.trim().length > 0 && matches.length === 0 && !canSendEmail ? (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-lg">
          No matches. Type an email to invite by email.
        </div>
      ) : null}
      <div className="mt-2 flex justify-end text-xs text-muted-foreground">
        <span>
          Press <kbd className="rounded border border-border bg-secondary/60 px-1">Enter</kbd> to
          pick the highlighted match.
        </span>
      </div>
    </div>
  );
}
