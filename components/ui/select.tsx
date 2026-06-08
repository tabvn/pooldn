"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "@base-ui-components/react/select";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: React.ReactNode;
};

export type SelectProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  name?: string;
  id?: string;
  invalid?: boolean;
};

/**
 * Styled, accessible Select built on @base-ui-components.
 *
 * Use `name` to participate in a `<form>` like a native select; the
 * underlying primitive renders a hidden input that mirrors the chosen value.
 */
export function Select({
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder,
  disabled,
  className,
  name,
  id,
  invalid,
}: SelectProps) {
  return (
    <SelectPrimitive.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={(v) => {
        if (typeof v === "string") onValueChange?.(v);
      }}
      disabled={disabled}
      name={name}
      items={options}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30",
          "data-[popup-open]:border-ring",
          className,
        )}
      >
        <SelectPrimitive.Value>
          {(selected) =>
            selected ? (
              <span>{labelFor(options, String(selected))}</span>
            ) : (
              <span className="text-muted-foreground">
                {placeholder ?? "Select…"}
              </span>
            )
          }
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon>
          <ChevronDown className="size-4 text-muted-foreground" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner sideOffset={4} align="start">
          <SelectPrimitive.Popup
            className={cn(
              "z-50 min-w-[var(--anchor-width)] overflow-hidden rounded-md border border-border bg-card p-1 shadow-2xl",
              "outline-none",
            )}
          >
            <SelectPrimitive.List>
              {options.map((opt) => (
                <SelectPrimitive.Item
                  key={opt.value}
                  value={opt.value}
                  className={cn(
                    "relative flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm",
                    "outline-none",
                    "data-[highlighted]:bg-secondary/60 data-[highlighted]:text-foreground",
                    "data-[selected]:font-semibold",
                  )}
                >
                  <SelectPrimitive.ItemIndicator>
                    <Check className="size-4 text-primary" />
                  </SelectPrimitive.ItemIndicator>
                  <SelectPrimitive.ItemText className="flex-1">
                    {opt.label}
                  </SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

function labelFor(opts: SelectOption[], value: string): React.ReactNode {
  return opts.find((o) => o.value === value)?.label ?? value;
}
