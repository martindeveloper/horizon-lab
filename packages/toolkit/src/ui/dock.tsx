import type { ComponentProps } from "react";

import { Surface } from "./surface";
import { cn } from "./utils";

export type DockProps = ComponentProps<"div"> & { footerClassName?: string };

/**
 * Bottom HUD bar shared by every simulation: panel glass, centered at one width
 * (full width and a little tighter on phones, 56rem at most) inside the
 * safe-area HUD padding.
 * `className` lays out the content, `footerClassName` its frame (e.g. right
 * padding to clear an open side rail).
 */
export function Dock({ className, footerClassName, ...props }: DockProps) {
  return (
    <footer className={cn("pad-hud-bottom absolute inset-x-0 bottom-0 z-30", footerClassName)}>
      <Surface
        className={cn(
          "pointer-events-auto mx-auto w-full max-w-4xl rounded-lg px-4 py-3 not-md:px-3.5 not-md:py-2.5",
          className,
        )}
        {...props}
      />
    </footer>
  );
}
