import type { ComponentProps } from "react";

import { Surface } from "./surface";
import { cn } from "./utils";

export type ToolbarProps = ComponentProps<"div"> & { "aria-label": string };

/** A labeled group of independent actions, using normal Tab navigation. On phones the gap
 * keeps each 36px button's 44px touch target clear of its neighbours. */
export function Toolbar({ className, ...props }: ToolbarProps) {
  return (
    <Surface
      variant="hud"
      role="group"
      className={cn(
        "pointer-events-auto flex items-center rounded-full p-0.5 not-md:gap-2",
        className,
      )}
      {...props}
    />
  );
}
