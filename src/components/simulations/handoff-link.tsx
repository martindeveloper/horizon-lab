"use client";

import { ArrowUpRight } from "lucide-react";
import type { ComponentProps, MouseEvent } from "react";

import { Link } from "@/i18n/navigation";
import { handoffPath, leaveFor, type HandoffSide } from "@/lib/handoff";
import type { SolarViewId } from "@/space/solar-system/model/views";
import { cn } from "@horizon/toolkit/ui";

/** A plain left click follows in this tab; a modified one opens elsewhere and carries nothing. */
const followsHere = (event: MouseEvent) =>
  event.button === 0 &&
  !event.defaultPrevented &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

/**
 * A link to the same solar system view in the other simulation, which opens at this side's
 * camera pose: the Orrery for its history, Deep Field for what lies beyond.
 */
export function HandoffLink({
  to,
  view,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { to: HandoffSide; view: SolarViewId }) {
  return (
    <Link
      {...props}
      href={handoffPath(to, view)}
      onClick={(event) => {
        if (followsHere(event)) leaveFor(to);
        onClick?.(event);
      }}
    />
  );
}

/**
 * The crossing as a quiet row in a list or a card's footer: a title, one muted line on what
 * the other side adds, and a gold arrow. "Further out · Deep Field" mirrors "Back in time ·
 * Orrery".
 */
export function HandoffRow({
  title,
  hint,
  className,
  ...props
}: Omit<ComponentProps<typeof HandoffLink>, "children"> & { title: string; hint: string }) {
  return (
    <HandoffLink
      {...props}
      className={cn(
        "flex min-h-11 w-full items-start justify-between gap-3 rounded-md px-3 py-2 text-left text-sm tracking-wide text-fg transition-colors duration-300 hover:bg-fg/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden md:min-h-9",
        className,
      )}
    >
      <span className="flex flex-col">
        <span>{title}</span>
        <span className="text-xs text-muted">{hint}</span>
      </span>
      <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-solar" aria-hidden />
    </HandoffLink>
  );
}
