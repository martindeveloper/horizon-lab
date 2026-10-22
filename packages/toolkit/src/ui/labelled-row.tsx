import type { ComponentProps, ReactNode } from "react";

import { kickerClass } from "./kicker";
import { cn } from "./utils";

export type LabelledRowProps = Omit<ComponentProps<"div">, "role"> & {
  /** The group's accessible name, shown as the row's label. */
  label: string;
  /** The visible label, when it differs from the spoken one; null shows none. */
  shown?: ReactNode;
};

/**
 * A group of controls with a mono label at its start, on every screen size. The content fills
 * the rest of the row and decides for itself whether it wraps or scrolls.
 */
export function LabelledRow({
  label,
  shown = label,
  className,
  children,
  ...props
}: LabelledRowProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex min-w-0 items-center gap-2", className)}
      {...props}
    >
      {shown === null ? null : (
        <span aria-hidden className={cn(kickerClass, "flex shrink-0 items-center gap-1.5")}>
          {shown}
        </span>
      )}
      {children}
    </div>
  );
}

/**
 * A labelled row of chips that scrolls sideways, its scrollbar hidden; with `wrap`, it wraps
 * instead from `md` up, where there is room.
 */
export function ChipRow({
  children,
  wrap = false,
  ...props
}: LabelledRowProps & { wrap?: boolean }) {
  return (
    <LabelledRow {...props}>
      {/* A scrolling row clips both ways: the room above and below keeps a chip's corner badge
          and focus ring whole. */}
      <div
        className={cn(
          "no-scrollbar -mx-1 -my-1.5 flex min-w-0 items-center gap-1 overflow-x-auto overscroll-x-contain px-1 py-1.5",
          wrap && "md:flex-wrap md:overflow-visible",
        )}
      >
        {children}
      </div>
    </LabelledRow>
  );
}
