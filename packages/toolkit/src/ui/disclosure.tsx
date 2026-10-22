import { ChevronDown } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "./utils";

export type DisclosureProps = ComponentProps<"details"> & {
  /** The closed row's words: what opening it reads. */
  summary: ReactNode;
};

/**
 * The longer print under a control or a figure (how to read it, evidence, limits, sources),
 * folded behind one quiet row whose chevron turns when open. Native `details`, so it works
 * from the keyboard and in a server render.
 */
export function Disclosure({ summary, className, children, ...props }: DisclosureProps) {
  return (
    <details className={cn("group border-t border-border", className)} {...props}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-control text-ui text-fg-secondary ui-focus transition-colors duration-feedback ease-standard hover:text-fg-primary md:min-h-9 [&::-webkit-details-marker]:hidden">
        {summary}
        <ChevronDown
          aria-hidden
          className="icon size-icon-compact transition-transform duration-control ease-standard group-open:rotate-180"
        />
      </summary>
      <div className="grid gap-3 pt-1 pb-2 text-ui leading-relaxed text-fg-secondary">
        {children}
      </div>
    </details>
  );
}
