import { cn } from "./utils";

type Props = { label: string; visible: boolean; className?: string };

/**
 * A quiet pill saying detail is still streaming in; it never blocks the scene. It shows after
 * a beat, so a quick load never flashes it, and fades out when the wait ends. The house mark's
 * orbiting spark, in the invariant scene palette.
 */
export function LoadingBadge({ label, visible, className }: Props) {
  return (
    <div className={cn("pointer-events-none", className)}>
      <span role="status" className="sr-only">
        {visible ? label : ""}
      </span>
      <span
        className={cn(
          "glass-pill inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs tracking-wide text-space-fg transition-opacity duration-500",
          visible ? "opacity-100 delay-500" : "opacity-0",
        )}
        aria-hidden="true"
      >
        <svg viewBox="0 0 48 48" className="size-3.5" fill="none">
          <circle cx="24" cy="24" r="20" strokeWidth="4" className="stroke-space-fg/25" />
          <g className="horizon-loading-orbit">
            <circle cx="24" cy="4" r="6" className="fill-solar" />
          </g>
        </svg>
        {label}
      </span>
    </div>
  );
}
