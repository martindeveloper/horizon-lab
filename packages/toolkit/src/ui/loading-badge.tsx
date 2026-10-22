import type { ReactNode } from "react";

import { cn } from "./utils";

type StatusProps = {
  label: string;
  visible: boolean;
  /** Drawn before the label. */
  icon?: ReactNode;
  /** In the solar accent rather than the scene's text colour. */
  accent?: boolean;
  /** Shows only after a beat, so a quick change never flashes it. */
  delayed?: boolean;
  className?: string | undefined;
};

/**
 * A quiet glass pill that says a state has begun, announced as it comes and goes. It keeps its
 * place while hidden, so nothing moves as it shows, and fades in and out.
 */
export function StatusBadge({ label, visible, icon, accent, delayed, className }: StatusProps) {
  return (
    <div className={cn("pointer-events-none", className)}>
      <span role="status" className="sr-only">
        {visible ? label : ""}
      </span>
      <span
        className={cn(
          "glass-pill inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs tracking-wide whitespace-nowrap transition-opacity duration-reveal ease-standard",
          accent ? "text-solar" : "text-space-fg",
          visible ? cn("opacity-100", delayed && "delay-(--loading-reveal-delay)") : "opacity-0",
        )}
        aria-hidden="true"
      >
        {icon}
        {label}
      </span>
    </div>
  );
}

/**
 * A quiet pill saying detail is still streaming in; it never blocks the scene. It shows after
 * a beat, so a quick load never flashes it, and fades out when the wait ends. The house mark's
 * orbiting spark, in the invariant scene palette.
 */
export function LoadingBadge({
  label,
  visible,
  className,
}: {
  label: string;
  visible: boolean;
  className?: string | undefined;
}) {
  return (
    <StatusBadge
      label={label}
      visible={visible}
      delayed
      className={className}
      icon={
        <svg viewBox="0 0 48 48" className="size-3.5" fill="none">
          <circle cx="24" cy="24" r="20" strokeWidth="4" className="stroke-space-fg/25" />
          <g className="horizon-loading-orbit">
            <circle cx="24" cy="4" r="6" className="fill-solar" />
          </g>
        </svg>
      }
    />
  );
}
