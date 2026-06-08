"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui-components/react/dialog";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

const CROP_SIZE = 320;
const OUTPUT_SIZE = 512; // square output, written at 2× for retina

/**
 * Avatar crop/zoom modal.
 *
 * Given a picked File, opens a circular crop window with drag-to-move and a
 * zoom slider. On save, renders the visible square to a 512×512 canvas and
 * returns a fresh File that the caller hands to the upload pipeline.
 *
 * Lives outside the upload component so it stays testable in isolation and
 * the upload code path doesn't change for non-avatar use cases.
 */
export function AvatarCropModal({
  file,
  open,
  onCancel,
  onConfirm,
}: {
  file: File | null;
  open: boolean;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
}) {
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Lifecycle — load the file into an object URL when the modal opens.
  useEffect(() => {
    if (!file || !open) {
      if (srcUrl) URL.revokeObjectURL(srcUrl);
      setSrcUrl(null);
      setImgSize(null);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      return;
    }
    const url = URL.createObjectURL(file);
    setSrcUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Base scale: fit image so its SHORTER side covers the crop window. The
  // user's zoom slider multiplies this.
  const baseScale = useMemo(() => {
    if (!imgSize) return 1;
    return CROP_SIZE / Math.min(imgSize.w, imgSize.h);
  }, [imgSize]);
  const scale = baseScale * zoom;

  // Clamp offset so the image edges never reveal the crop background.
  const clampedOffset = useMemo(() => {
    if (!imgSize) return offset;
    const w = imgSize.w * scale;
    const h = imgSize.h * scale;
    const maxX = Math.max(0, (w - CROP_SIZE) / 2);
    const maxY = Math.max(0, (h - CROP_SIZE) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, offset.x)),
      y: Math.max(-maxY, Math.min(maxY, offset.y)),
    };
  }, [imgSize, scale, offset]);

  const onImgLoad = useCallback(() => {
    const el = imgRef.current;
    if (!el) return;
    setImgSize({ w: el.naturalWidth, h: el.naturalHeight });
    setOffset({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    dragRef.current = { x: e.clientX, y: e.clientY };
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragRef.current = null;
  }

  async function onSave() {
    if (!imgRef.current || !imgSize || !file) return;
    // Map the displayed CROP window back to source-image pixel coordinates.
    // Source-pixel width that fills the crop window is CROP_SIZE / scale.
    const sw = CROP_SIZE / scale;
    const sh = CROP_SIZE / scale;
    // Centered baseline + user pan offset (in CSS pixels) → source-pixel.
    const sx = imgSize.w / 2 - sw / 2 - clampedOffset.x / scale;
    const sy = imgSize.h / 2 - sh / 2 - clampedOffset.y / scale;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png", 0.92),
    );
    if (!blob) return;
    const cropped = new File([blob], file.name.replace(/\.[^.]+$/, ".png"), {
      type: "image/png",
    });
    onConfirm(cropped);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <DialogPrimitive.Popup
          className="fixed left-1/2 top-1/2 z-50 w-[420px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-xl outline-none"
          data-testid="avatar-crop-modal"
        >
          <DialogPrimitive.Title className="text-lg font-bold">
            Adjust your photo
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">
            Drag to reposition. Use the slider to zoom.
          </DialogPrimitive.Description>

          <div
            className="mx-auto mt-4 select-none overflow-hidden rounded-full border border-border bg-secondary/40"
            style={{ width: CROP_SIZE, height: CROP_SIZE }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {srcUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={imgRef}
                src={srcUrl}
                alt=""
                draggable={false}
                onLoad={onImgLoad}
                className="pointer-events-none select-none"
                style={{
                  transform: `translate(calc(-50% + ${clampedOffset.x}px), calc(-50% + ${clampedOffset.y}px)) scale(${scale})`,
                  transformOrigin: "0 0",
                  position: "relative",
                  left: "50%",
                  top: "50%",
                  maxWidth: "none",
                }}
              />
            ) : null}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <ZoomOut className="size-4 text-muted-foreground" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-primary"
              aria-label="Zoom"
            />
            <ZoomIn className="size-4 text-muted-foreground" />
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={!srcUrl || !imgSize}>
              Save photo
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
