"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { AvatarCropModal } from "@/components/ui/avatar-crop-modal";
import { useToast } from "@/components/ui/toast";

const ACCEPT = "image/png,image/jpeg,image/jpg,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;

export type ImageUploadKind =
  | "avatar"
  | "team-logo"
  | "team-logo-draft"
  | "competition-banner"
  | "venue-image";

type Shape = "circle" | "square" | "wide";

export type ImageUploadProps = {
  kind: ImageUploadKind;
  ownerId: string;
  /** Initial image URL to display. */
  value?: string | null;
  /** Fallback used for the empty/loading avatar (initials). */
  fallback?: string;
  shape?: Shape;
  /** Called with the new public URL after a successful upload. */
  onChange?: (url: string) => void;
  disabled?: boolean;
};

const SHAPE_CLASS: Record<Shape, string> = {
  circle: "size-24 rounded-full",
  square: "size-32 rounded-xl",
  wide: "h-32 w-full rounded-xl",
};

export function ImageUpload({
  kind,
  ownerId,
  value,
  fallback,
  shape = "circle",
  onChange,
  disabled,
}: ImageUploadProps) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(value ?? null);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  // Avatars and team logos route through the crop modal so users can zoom,
  // pan and reframe before persisting. Everything else uploads directly.
  const requiresCrop =
    kind === "avatar" ||
    kind === "team-logo" ||
    kind === "team-logo-draft";
  // Avatars are circular; team logos crop to a square frame.
  const cropShape: "circle" | "square" =
    kind === "team-logo" || kind === "team-logo-draft" ? "square" : "circle";
  const cropTitle =
    kind === "team-logo" || kind === "team-logo-draft"
      ? "Adjust your team logo"
      : "Adjust your photo";
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Stay in sync with the parent's value (e.g. after a refetch returns a
  // new avatarUrl with a different cache-buster, or when the entity changes
  // between renders). Without this the local preview gets out of step with
  // the persisted URL the rest of the app reads.
  useEffect(() => {
    setPreviewUrl(value ?? null);
  }, [value]);

  const upload = useCallback(
    async (file: File) => {
      if (!ACCEPT.split(",").includes(file.type)) {
        toast.error("Unsupported file type", "Use PNG, JPG or WebP.");
        return;
      }
      if (file.size > MAX_BYTES) {
        toast.error(
          "File too large",
          `Max ${(MAX_BYTES / 1024 / 1024).toFixed(0)} MB.`,
        );
        return;
      }
      // Optimistic preview using a local object URL.
      const local = URL.createObjectURL(file);
      setPreviewUrl(local);

      const body = new FormData();
      body.set("kind", kind);
      body.set("ownerId", ownerId);
      body.set("file", file);

      try {
        setProgress(0);
        const url = await uploadWithProgress(body, setProgress);
        setPreviewUrl(url);
        URL.revokeObjectURL(local);
        toast.success("Image uploaded");
        onChange?.(url);
      } catch (e) {
        setPreviewUrl(value ?? null);
        toast.error("Upload failed", e instanceof Error ? e.message : "Try again.");
      } finally {
        setProgress(null);
      }
    },
    [kind, ownerId, onChange, toast, value],
  );

  function handlePicked(file: File) {
    if (!ACCEPT.split(",").includes(file.type)) {
      toast.error("Unsupported file type", "Use PNG, JPG or WebP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(
        "File too large",
        `Max ${(MAX_BYTES / 1024 / 1024).toFixed(0)} MB.`,
      );
      return;
    }
    if (requiresCrop) {
      setPendingFile(file);
    } else {
      void upload(file);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handlePicked(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handlePicked(file);
  }

  function clear() {
    setPreviewUrl(null);
    onChange?.("");
  }

  return (
    <div
      className={cn(
        "flex items-center gap-4",
        shape === "wide" && "flex-col items-stretch",
      )}
    >
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={disabled ? undefined : onDrop}
        className={cn(
          "relative overflow-hidden border-2 border-dashed",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border bg-secondary/30",
          SHAPE_CLASS[shape],
          shape === "circle" && "p-0",
        )}
        data-testid={`image-upload-${kind}`}
      >
        {previewUrl ? (
          shape === "circle" ? (
            <Avatar
              size="xl"
              src={previewUrl}
              fallback={fallback ?? "?"}
              className="size-full"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={fallback ?? "Image"}
              className="size-full object-cover"
            />
          )
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center text-center text-muted-foreground">
            <ImagePlus className="size-6 mb-1" />
            <span className="text-[10px] uppercase tracking-wider">
              Drop or browse
            </span>
          </div>
        )}
        {progress != null ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : null}
      </div>

      <div className={cn("flex flex-col gap-2", shape === "wide" && "w-full")}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={disabled || progress != null}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
          >
            <Upload className="size-3.5" />
            {previewUrl ? "Replace" : "Upload"}
          </button>
          {previewUrl ? (
            <button
              type="button"
              disabled={disabled || progress != null}
              onClick={clear}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <X className="size-3.5" />
              Remove
            </button>
          ) : null}
        </div>
        <p className="text-[11px] text-muted-foreground">
          PNG, JPG or WebP. Up to 5 MB.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={onPick}
      />

      {requiresCrop ? (
        <AvatarCropModal
          file={pendingFile}
          open={pendingFile !== null}
          shape={cropShape}
          title={cropTitle}
          onCancel={() => setPendingFile(null)}
          onConfirm={(cropped) => {
            setPendingFile(null);
            void upload(cropped);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Use XHR (not fetch) so we get progress events for the byte stream.
 * Returns the public URL on success.
 */
function uploadWithProgress(
  body: FormData,
  onProgress: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve((xhr.response as { url: string }).url);
      } else {
        reject(new Error(xhr.response?.error ?? `HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(body);
  });
}
