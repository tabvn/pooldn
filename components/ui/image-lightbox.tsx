"use client";

import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui-components/react/dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * Controlled full-size image viewer. Opens the image(s) in a centered modal
 * (backdrop + close button) rather than a new browser tab, so users stay on
 * the page. When more than one image is passed it supports prev/next
 * navigation (arrow keys + on-screen chevrons).
 */
export function ImageLightbox({
  images,
  index,
  open,
  onClose,
  onIndexChange,
  alt = "Image",
}: {
  images: string[];
  index: number;
  open: boolean;
  onClose: () => void;
  onIndexChange: (i: number) => void;
  alt?: string;
}) {
  const count = images.length;
  const hasMany = count > 1;

  const go = (delta: number) => {
    if (!hasMany) return;
    onIndexChange((index + delta + count) % count);
  };

  // Arrow-key navigation while the viewer is open.
  useEffect(() => {
    if (!open || !hasMany) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasMany, index, count]);

  const src = images[index];

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
        <DialogPrimitive.Popup
          data-testid="image-lightbox"
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 flex-col items-center outline-none"
        >
          <DialogPrimitive.Title className="sr-only">{alt}</DialogPrimitive.Title>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute -top-2 right-0 z-10 flex size-9 -translate-y-full items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
          >
            <X className="size-5" />
          </button>

          {src ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={src}
              alt={alt}
              className="max-h-[92vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
            />
          ) : null}

          {hasMany ? (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous image"
                className="absolute left-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next image"
                className="absolute right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
              >
                <ChevronRight className="size-6" />
              </button>
              <span className="mt-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
                {index + 1} / {count}
              </span>
            </>
          ) : null}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * Self-contained thumbnail strip that opens the full-size {@link ImageLightbox}
 * on click. Drop-in replacement for an `<a target="_blank">` image grid.
 */
export function ImageThumbnails({
  images,
  alt = "Image",
  className = "flex flex-wrap gap-1.5",
  thumbClassName = "size-16",
  testIdPrefix,
}: {
  images: string[];
  alt?: string;
  className?: string;
  thumbClassName?: string;
  testIdPrefix?: string;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  if (images.length === 0) return null;

  return (
    <>
      <div className={className} data-testid={testIdPrefix}>
        {images.map((u, i) => (
          <button
            key={u}
            type="button"
            onClick={() => {
              setIndex(i);
              setOpen(true);
            }}
            className={`block cursor-zoom-in overflow-hidden rounded border border-border transition-colors hover:border-primary/60 ${thumbClassName}`}
            data-testid={testIdPrefix ? `${testIdPrefix}-${i}` : undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={alt} className="size-full object-cover" />
          </button>
        ))}
      </div>
      <ImageLightbox
        images={images}
        index={index}
        open={open}
        onClose={() => setOpen(false)}
        onIndexChange={setIndex}
        alt={alt}
      />
    </>
  );
}
