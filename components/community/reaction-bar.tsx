"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@apollo/client/react";
import { Heart } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { ToggleCommunityReactionMutation } from "@/lib/graphql/operations/community.operations";

type ReactionType = "LIKE" | "FIRE" | "LAUGH" | "CLAP" | "TROPHY";

const EMOJI: Record<ReactionType, string> = {
  LIKE: "❤️",
  FIRE: "🔥",
  LAUGH: "😂",
  CLAP: "👏",
  TROPHY: "🏆",
};

const LABEL: Record<ReactionType, string> = {
  LIKE: "Like",
  FIRE: "Fire",
  LAUGH: "Haha",
  CLAP: "Clap",
  TROPHY: "Trophy",
};

const ORDER: ReactionType[] = ["LIKE", "FIRE", "LAUGH", "CLAP", "TROPHY"];

/**
 * Round-44 — improved reaction picker.
 *
 * Interaction model:
 *   - Tap the heart → toggle LIKE (the default).
 *   - Hover the heart for 300ms → reveal the popover with 5 emoji.
 *   - Long-press the heart (touch) → reveal the popover.
 *   - Popover sticks until you pick something OR pointer leaves it.
 *   - Picking a reaction toggles it on/off.
 *   - Escape / outside-click dismisses the popover.
 *   - Tooltip on each emoji ("Like", "Fire", …) for screen readers + slow
 *     pointer users.
 */
export function ReactionBar({
  postId,
  total,
  counts,
  viewerReactions,
  viewerId,
}: {
  postId: string;
  total: number;
  counts: Array<{ type: ReactionType; count: number }>;
  viewerReactions: ReactionType[];
  viewerId: string | null;
}) {
  const toast = useToast();
  const [openPicker, setOpenPicker] = useState(false);
  const [toggle, { loading }] = useMutation(ToggleCommunityReactionMutation);
  const viewerSet = new Set(viewerReactions);
  const countByType = new Map(counts.map((c) => [c.type, c.count]));
  const viewerLikes = viewerSet.has("LIKE");
  const containerRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelHover() {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
  }
  function cancelLongPress() {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }

  // Esc + outside click closes the picker.
  useEffect(() => {
    if (!openPicker) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenPicker(false);
    }
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpenPicker(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [openPicker]);

  async function pick(type: ReactionType) {
    if (!viewerId) {
      toast.error("Sign in to react");
      return;
    }
    setOpenPicker(false);
    try {
      await toggle({ variables: { postId, type } });
    } catch (e) {
      toast.error("Could not react", e);
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center gap-1"
      onMouseLeave={() => {
        cancelHover();
        // Slight grace period so a quick traverse off+on doesn't snap the
        // picker shut while the pointer is en route to it.
        setTimeout(() => setOpenPicker((open) => (open && false) || false), 80);
      }}
    >
      <button
        type="button"
        onMouseEnter={() => {
          cancelHover();
          hoverTimerRef.current = setTimeout(() => setOpenPicker(true), 300);
        }}
        onTouchStart={() => {
          cancelLongPress();
          longPressTimerRef.current = setTimeout(
            () => setOpenPicker(true),
            350,
          );
        }}
        onTouchEnd={cancelLongPress}
        onTouchCancel={cancelLongPress}
        onClick={() => pick("LIKE")}
        disabled={loading}
        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
          viewerLikes
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
        data-testid={`post-like-${postId}`}
        aria-label={
          viewerSet.size > 0
            ? `Reacted ${[...viewerSet].map((t) => LABEL[t]).join(", ")}`
            : "React"
        }
        aria-haspopup="menu"
        aria-expanded={openPicker}
      >
        <Heart className={`size-3.5 ${viewerLikes ? "fill-current" : ""}`} />
        {total}
      </button>

      {/* Inline summary chips of present reactions */}
      {counts.length > 0 ? (
        <div className="flex items-center gap-0.5 text-xs">
          {ORDER.filter((t) => (countByType.get(t) ?? 0) > 0).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => pick(t)}
              className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 transition ${
                viewerSet.has(t)
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              }`}
              data-testid={`reaction-${postId}-${t}`}
              aria-label={`${LABEL[t]} (${countByType.get(t)})`}
              title={LABEL[t]}
            >
              <span>{EMOJI[t]}</span>
              <span className="tabular-nums">{countByType.get(t)}</span>
            </button>
          ))}
        </div>
      ) : null}

      {/* Picker popover */}
      {openPicker && viewerId ? (
        <div
          onMouseEnter={cancelHover}
          className="absolute bottom-full left-0 z-30 mb-1 flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1.5 shadow-xl animate-in fade-in zoom-in-95"
          role="menu"
          aria-label="Reactions"
          data-testid={`reaction-picker-${postId}`}
        >
          {ORDER.map((t) => {
            const active = viewerSet.has(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => pick(t)}
                title={LABEL[t]}
                className={`relative inline-flex size-8 items-center justify-center rounded-full text-xl leading-none transition-transform hover:scale-125 ${
                  active ? "bg-primary/15 ring-2 ring-primary/40" : ""
                }`}
                aria-label={LABEL[t]}
                aria-pressed={active}
                data-testid={`reaction-pick-${postId}-${t}`}
              >
                {EMOJI[t]}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
