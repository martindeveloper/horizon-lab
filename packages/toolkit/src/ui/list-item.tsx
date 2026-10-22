"use client";

import type { ComponentProps, ReactNode } from "react";

import { kickerClass } from "./kicker";
import { cn } from "./utils";

export type ListItemProps = ComponentProps<"button"> & {
  selected?: boolean;
  /** A leading mark (an `Orb`, an icon), centred in a column of its own so names line up. */
  icon?: ReactNode;
  /** A trailing figure or tag, in mono. */
  detail?: ReactNode;
};

/**
 * Full-width row in a menu, picker or panel list. `selected={false}` mutes rows
 * beside the current one; the current row is tinted, marked by a gold notch and
 * exposed as aria-current.
 */
export function ListItem({
  selected,
  icon,
  detail,
  className,
  children,
  type = "button",
  ...props
}: ListItemProps) {
  const slotted = icon !== undefined || detail !== undefined;
  return (
    <button
      type={type}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "relative flex min-h-11 w-full ui-disabled items-center justify-between gap-3 rounded-control ui-press px-3 py-2 text-left text-body/5 tracking-wide ui-focus transition-colors duration-feedback ease-standard md:min-h-9",
        selected
          ? "ui-selected text-fg-primary before:absolute before:inset-y-2.5 before:left-0 before:w-0.5 before:rounded-full before:bg-accent"
          : selected === false
            ? "ui-row text-fg-secondary ui-quiet"
            : "ui-row text-fg-primary",
        className,
      )}
      {...props}
    >
      {icon !== undefined ? <span className="list-glyph">{icon}</span> : null}
      {slotted ? <span className="min-w-0 flex-1 truncate">{children}</span> : children}
      {detail !== undefined ? (
        <span className="shrink-0 font-mono text-caption tracking-wide text-fg-tertiary tabular-nums">
          {detail}
        </span>
      ) : null}
    </button>
  );
}

/**
 * An ordered list read as a route (the Sun from its core out, bodies by size, places by
 * distance): a hairline joins the rows' `icon` marks, gold up to the current row, whose mark is
 * ringed. Bleeds to its container's edges like a row group (`className` sets the bleed).
 */
export function ListTrack({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("list-track grid", className)} {...props} />;
}

/** A stage name between a track's rows, over the names' column; the route runs on past it. */
export function ListTrackLabel({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("list-track-label", kickerClass, className)} {...props} />;
}

export type ListHeadingProps = ComponentProps<"h3"> & { count?: number | undefined };

/** A list's title, with its `count` set after a hairline like an atlas index. */
export function ListHeading({ count, className, children, ...props }: ListHeadingProps) {
  return (
    <h3 className={cn(kickerClass, "flex items-center gap-3", className)} {...props}>
      {children}
      {count === undefined ? null : (
        <>
          <span aria-hidden className="h-px flex-1 bg-border-strong" />
          <span aria-hidden className="tabular-nums">
            {count}
          </span>
        </>
      )}
    </h3>
  );
}
