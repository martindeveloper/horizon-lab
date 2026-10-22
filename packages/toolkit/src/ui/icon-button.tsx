"use client";

import type { ComponentProps } from "react";

import { cn } from "./utils";

export type IconButtonProps = ComponentProps<"button"> & {
  "aria-label": string;
  active?: boolean;
};

/**
 * Compact HUD action: 36px on phones with a 44px touch target, 32px on desktop.
 * Lucide children default to the toolbar icon role.
 */
export function IconButton({
  className,
  active = false,
  onClick,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "icon-button relative flex size-9 ui-disabled items-center justify-center rounded-full ui-press ui-focus transition-[color,background-color,filter] duration-feedback ease-standard not-md:after:absolute not-md:after:-inset-1 md:size-8",
        active
          ? "bg-state-pressed text-fg-primary enabled-active:brightness-(--control-press-brightness)"
          : "text-fg-primary/80 ui-quiet",
        className,
      )}
      {...props}
      onClick={(event) => {
        // ARIA-disabled controls stay focusable, but neither pointer nor keyboard clicks act.
        if (props["aria-disabled"] === true || props["aria-disabled"] === "true") {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClick?.(event);
      }}
    />
  );
}
