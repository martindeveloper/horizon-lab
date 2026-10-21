"use client";

import type { ComponentProps, MouseEvent } from "react";

import { CrossingContent, crossingRowClass } from "@/components/simulations/crossing-row";
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
    <HandoffLink {...props} className={cn(crossingRowClass, className)}>
      <CrossingContent title={title} hint={hint} />
    </HandoffLink>
  );
}
