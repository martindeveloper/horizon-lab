"use client";

import type { ComponentProps } from "react";

import { cn } from "./utils";

export type ListItemProps = ComponentProps<"button"> & { selected?: boolean };

/**
 * Full-width row in a menu, picker or panel list. `selected={false}` mutes rows
 * beside the current one; the current row is tinted and exposed as aria-current.
 */
export function ListItem({ selected, className, type = "button", ...props }: ListItemProps) {
  return (
    <button
      type={type}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm tracking-wide transition-colors duration-300 hover:bg-fg/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden md:min-h-9",
        selected
          ? "bg-fg/[0.07] text-fg"
          : selected === false
            ? "text-muted hover:text-fg"
            : "text-fg",
        className,
      )}
      {...props}
    />
  );
}
