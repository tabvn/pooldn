"use client";

import { Menu as MenuPrimitive } from "@base-ui-components/react/menu";
import { cn } from "@/lib/utils";

export function DropdownMenu(props: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root {...props} />;
}

export function DropdownMenuTrigger({
  className,
  ...props
}: MenuPrimitive.Trigger.Props) {
  return (
    <MenuPrimitive.Trigger
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-secondary/50 text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuContent({
  className,
  children,
  ...props
}: MenuPrimitive.Popup.Props) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner sideOffset={6} align="end">
        <MenuPrimitive.Popup
          className={cn(
            "min-w-48 overflow-hidden rounded-lg border border-border bg-card p-1 shadow-2xl",
            "outline-none",
            className,
          )}
          {...props}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  variant = "default",
  ...props
}: MenuPrimitive.Item.Props & { variant?: "default" | "danger" }) {
  return (
    <MenuPrimitive.Item
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
        "outline-none cursor-pointer",
        variant === "default" &&
          "text-foreground data-[highlighted]:bg-secondary/60",
        variant === "danger" &&
          "text-destructive data-[highlighted]:bg-destructive/15",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator() {
  return <MenuPrimitive.Separator className="my-1 h-px bg-border" />;
}
