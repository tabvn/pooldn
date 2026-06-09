"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

/**
 * Click-to-zoom for community post images. Renders a 1-N grid (1=full,
 * 2=2-col, 3+=3-col); tapping any image opens a fullscreen lightbox with
 * arrow-key + ESC navigation.
 */
export function CommunityImages({ urls }: { urls: string[] }) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i! + 1) % urls.length);
      if (e.key === "ArrowLeft")
        setOpen((i) => (i! - 1 + urls.length) % urls.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, urls.length]);

  if (urls.length === 0) return null;

  const gridClass =
    urls.length === 1
      ? "grid-cols-1"
      : urls.length === 2
        ? "grid-cols-2"
        : "grid-cols-3";

  return (
    <>
      <div className={`mt-2 grid gap-1.5 ${gridClass}`}>
        {urls.map((u, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setOpen(i)}
            className="overflow-hidden rounded-lg border border-border bg-secondary/30"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={u}
              alt=""
              className="aspect-square w-full object-cover transition hover:opacity-90"
              loading="lazy"
            />
          </button>
        ))}
      </div>
      {open !== null ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setOpen(null)}
          role="dialog"
          aria-modal
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urls[open]}
            alt=""
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setOpen(null)}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
          {urls.length > 1 ? (
            <div className="absolute bottom-4 text-xs text-white/80">
              {open + 1} / {urls.length}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
