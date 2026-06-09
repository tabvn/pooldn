"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui-components/react/dialog";
import { RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

const CROP_SIZE = 320; // px on screen
const OUTPUT_SIZE = 512; // px in the saved PNG (2× retina)

/**
 * Avatar crop / zoom / rotate modal.
 *
 * Math: the image is positioned absolutely at the crop window's centre and
 * transformed by `translate(panX, panY) rotate(rotation) scale(scale)`. To
 * save, we replay the SAME transform onto an off-screen canvas of OUTPUT_SIZE
 * — so what the user sees inside the circle is exactly what gets written.
 *
 * `scale` starts at the value that makes the image's SHORTER side cover the
 * crop window (`baseScale`) multiplied by a user-zoom slider (1×–4×).
 */
export function AvatarCropModal({
  file,
  open,
  onCancel,
  onConfirm,
  shape = "circle",
  title,
}: {
  file: File | null;
  open: boolean;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
  /** "circle" for avatars; "square" for team logos / generic 1:1 crops. */
  shape?: "circle" | "square";
  title?: string;
}) {
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1); // user multiplier on top of baseScale
  const [rotation, setRotation] = useState(0); // degrees
  const [pan, setPan] = useState({ x: 0, y: 0 }); // in CSS pixels
  const [working, setWorking] = useState(false);
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  const imgRef = useRef<HTMLImageElement>(null);

  // Load the picked file as a blob URL when the modal opens; reset state.
  useEffect(() => {
    if (!file || !open) {
      setSrcUrl(null);
      setImgSize(null);
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });
      return;
    }
    const url = URL.createObjectURL(file);
    setSrcUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, open]);

  const baseScale = useMemo(() => {
    if (!imgSize) return 1;
    // Cover the SHORTER side so the crop never sees background.
    return CROP_SIZE / Math.min(imgSize.w, imgSize.h);
  }, [imgSize]);
  const scale = baseScale * zoom;

  const clampedPan = useMemo(() => {
    if (!imgSize) return pan;
    // Clamp so the rotated/scaled image still covers the crop window.
    // For non-axis-aligned rotations we approximate with a circle radius equal
    // to half the shorter side; conservative but never reveals background.
    const w = imgSize.w * scale;
    const h = imgSize.h * scale;
    // Use the bounding-box approach (works perfectly when rotation is a
    // multiple of 90°, slightly looser otherwise).
    const r = Math.abs(rotation % 180);
    const swap = r > 45 && r < 135;
    const effW = swap ? h : w;
    const effH = swap ? w : h;
    const maxX = Math.max(0, (effW - CROP_SIZE) / 2);
    const maxY = Math.max(0, (effH - CROP_SIZE) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, pan.x)),
      y: Math.max(-maxY, Math.min(maxY, pan.y)),
    };
  }, [imgSize, scale, rotation, pan]);

  function onImgLoad() {
    const el = imgRef.current;
    if (!el) return;
    setImgSize({ w: el.naturalWidth, h: el.naturalHeight });
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      px: clampedPan.x,
      py: clampedPan.y,
    };
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setPan({ x: dragRef.current.px + dx, y: dragRef.current.py + dy });
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragRef.current = null;
  }
  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    // Mouse-wheel zoom: scroll up zooms in.
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setZoom((z) => clamp(z + delta, 1, 4));
  }

  async function onSave() {
    if (!imgRef.current || !imgSize || !file || working) return;
    setWorking(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingQuality = "high";
      // Replay the visible transform onto the canvas, scaled from CROP_SIZE
      // up to OUTPUT_SIZE.
      const R = OUTPUT_SIZE / CROP_SIZE;
      ctx.translate(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2);
      ctx.translate(clampedPan.x * R, clampedPan.y * R);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(scale * R, scale * R);
      ctx.drawImage(
        imgRef.current,
        -imgSize.w / 2,
        -imgSize.h / 2,
        imgSize.w,
        imgSize.h,
      );
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png", 0.92),
      );
      if (!blob) return;
      const cropped = new File(
        [blob],
        file.name.replace(/\.[^.]+$/, ".png"),
        { type: "image/png" },
      );
      onConfirm(cropped);
    } finally {
      setWorking(false);
    }
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
            {title ?? "Adjust your photo"}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">
            Drag to reposition · scroll to zoom · use the controls below.
          </DialogPrimitive.Description>

          {/* Crop window — circle for avatars, rounded-square for logos. */}
          <div
            className={`relative mx-auto mt-4 select-none overflow-hidden border border-border bg-secondary/40 ${
              shape === "circle" ? "rounded-full" : "rounded-xl"
            }`}
            style={{ width: CROP_SIZE, height: CROP_SIZE, touchAction: "none" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
          >
            {srcUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={imgRef}
                src={srcUrl}
                alt=""
                draggable={false}
                onLoad={onImgLoad}
                style={{
                  position: "absolute",
                  // Centre the image's own centre in the crop window, then
                  // apply pan / rotate / scale around that origin.
                  left: "50%",
                  top: "50%",
                  transform: `translate(-50%, -50%) translate(${clampedPan.x}px, ${clampedPan.y}px) rotate(${rotation}deg) scale(${scale})`,
                  transformOrigin: "center center",
                  willChange: "transform",
                  pointerEvents: "none",
                  maxWidth: "none",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                }}
              />
            ) : null}
          </div>

          {/* Zoom + Rotate controls */}
          <div className="mt-4 space-y-3">
            <div
              className="flex items-center gap-3"
              data-testid="avatar-crop-zoom"
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setZoom((z) => clamp(z - 0.25, 1, 4))}
                aria-label="Zoom out"
              >
                <ZoomOut className="size-4" />
              </Button>
              <input
                type="range"
                min={1}
                max={4}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-primary"
                aria-label="Zoom"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setZoom((z) => clamp(z + 0.25, 1, 4))}
                aria-label="Zoom in"
              >
                <ZoomIn className="size-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Zoom <span className="font-mono">{zoom.toFixed(2)}×</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                iconBefore={<RotateCw className="size-4" />}
                data-testid="avatar-crop-rotate"
              >
                Rotate 90°
              </Button>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setZoom(1);
                setRotation(0);
                setPan({ x: 0, y: 0 });
              }}
            >
              Reset
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                onClick={onSave}
                disabled={!srcUrl || !imgSize}
                loading={working}
              >
                Save photo
              </Button>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
