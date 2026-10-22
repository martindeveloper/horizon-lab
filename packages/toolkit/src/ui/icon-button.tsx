"use client";

import type { ComponentProps } from "react";

import { cn } from "./utils";

export type IconButtonProps = ComponentProps<"button"> & {
  "aria-label": string;
  active?: boolean;
};

/** Compact HUD action: 36px on phones with a 44px touch target around it, 32px on desktop. */
export function IconButton({
  className,
  active = false,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "relative flex size-9 items-center justify-center rounded-full transition-colors duration-feedback ease-standard not-md:after:absolute not-md:after:-inset-1 focus-visible:ring-focus focus-visible:ring-ring focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-40 md:size-8",
        active ? "bg-fg-primary/10 text-fg-primary" : "text-fg-primary/80 hover:text-fg-primary",
        className,
      )}
      {...props}
    />
  );
}
