import type { ComponentProps, ReactNode } from "react";

import { cn } from "@horizon/toolkit/ui";

/**
 * The header's top-left slot, before the toolbar: the view's caption and the keys to what the
 * map draws, centred on the toolbar's row and wrapping under each other; phones take it a row
 * lower, under the tools. Its items position nothing themselves.
 */
export function CaptionSlot({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-ui text-space-muted not-md:order-last not-md:basis-full md:min-h-9">
      {children}
    </div>
  );
}

/** A key in the slot that opens what it labels: its mark, then its words. */
export function CaptionKey({
  mark,
  className,
  children,
  ...props
}: ComponentProps<"button"> & { mark: ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-control text-left ui-focus hover:text-space-fg md:min-h-9",
        className,
      )}
      {...props}
    >
      {mark}
      {children}
    </button>
  );
}
