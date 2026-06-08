import * as React from "react";
import { cn } from "@/lib/utils";

export function IconChip({
  icon,
  label,
  tone = "neutral",
  className,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  tone?: "neutral" | "primary" | "success" | "warning" | "danger";
  className?: string;
}) {
  const palette = {
    neutral: "bg-secondary/60 text-foreground border-border",
    primary: "bg-primary/15 text-primary border-primary/25",
    success: "bg-success/15 text-success border-success/25",
    warning: "bg-warning/15 text-warning border-warning/25",
    danger: "bg-destructive/15 text-destructive border-destructive/25",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold",
        palette,
        className,
      )}
    >
      <span className="[&>svg]:size-3.5 [&>svg]:shrink-0">{icon}</span>
      {label}
    </span>
  );
}
