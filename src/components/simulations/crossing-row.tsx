"use client";

import { ArrowUpRight } from "lucide-react";
import type { ComponentProps } from "react";

import { Link } from "@/i18n/navigation";
import { cn } from "@horizon/toolkit/ui";

/** A crossing's look: a quiet row with a title, one muted line and a gold arrow. */
export const crossingRowClass =
  "flex min-h-11 w-full items-start justify-between gap-3 rounded-md px-3 py-2 text-left text-sm tracking-wide text-fg transition-colors duration-300 hover:bg-fg/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden md:min-h-9";

/** What a crossing row says: where it goes and what the other side adds. */
export function CrossingContent({ title, hint }: { title: string; hint: string }) {
  return (
    <>
      <span className="flex flex-col">
        <span>{title}</span>
        <span className="text-xs text-muted">{hint}</span>
      </span>
      <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
    </>
  );
}

/**
 * A link to another simulation as a quiet row in a list or a card's footer, e.g. a body's card
 * opening the lab that shows it up close.
 */
export function CrossingRow({
  title,
  hint,
  className,
  ...props
}: Omit<ComponentProps<typeof Link>, "children"> & { title: string; hint: string }) {
  return (
    <Link {...props} className={cn(crossingRowClass, className)}>
      <CrossingContent title={title} hint={hint} />
    </Link>
  );
}
