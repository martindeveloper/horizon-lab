import { cn } from "./utils";

type Props = { title: string; status: string; className?: string };

/**
 * Quiet, CSS-only loading state shared by every simulation: the house mark
 * with one spark in orbit, the name, and a short status. No fabricated progress.
 * Painted in the invariant scene palette, since every stage is dark in both themes.
 */
export function LoadingScreen({ title, status, className }: Props) {
  return (
    <div
      className={cn(
        "horizon-loading flex h-full min-h-64 items-center justify-center bg-space px-6 text-center text-space-fg",
        className,
      )}
      role="status"
    >
      <div className="flex flex-col items-center">
        <svg viewBox="0 0 48 48" className="size-12" fill="none" aria-hidden="true">
          <defs>
            <clipPath id="horizon-loading-above">
              <rect x="0" y="0" width="48" height="24" />
            </clipPath>
          </defs>
          <circle cx="24" cy="24" r="20" className="stroke-space-fg/20" />
          <circle
            cx="24"
            cy="24"
            r="6"
            className="horizon-loading-sun fill-solar"
            clipPath="url(#horizon-loading-above)"
          />
          <line x1="6" y1="24" x2="42" y2="24" className="stroke-solar" />
          <g className="horizon-loading-orbit">
            <circle cx="24" cy="4" r="1.5" className="fill-solar" />
          </g>
        </svg>
        <p className="mt-5 text-[15px] font-semibold tracking-tight">{title}</p>
        <p className="mt-1 text-[13px] text-space-muted">{status}</p>
      </div>
    </div>
  );
}
