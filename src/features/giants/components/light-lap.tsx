import { useReducedMotion } from "motion/react";

/**
 * A marker completes a ring every equatorial circumference / c, a geometric comparison:
 * 14.6 seconds for the Sun, a fraction of a millisecond for a neutron star, hours for a red
 * supergiant. This is not a physical photon orbit. Under reduced motion or for periods below
 * 0.25 seconds the ring stands still.
 */
export function LightLap({ seconds, label }: { seconds: number; label: string }) {
  const still = useReducedMotion() || !(seconds > 0.25);
  return (
    <span className="flex min-w-0 items-center gap-2 text-xs text-fg-secondary">
      <svg viewBox="0 0 28 28" className="size-7 shrink-0" aria-hidden>
        <circle cx="14" cy="14" r="10" fill="none" stroke="currentColor" strokeOpacity="0.35" />
        <g
          className={still ? undefined : "giants-lap"}
          style={still ? undefined : { animationDuration: `${seconds}s` }}
        >
          <circle cx="14" cy="4" r="2" className="fill-solar" />
        </g>
      </svg>
      <span className="truncate">{label}</span>
    </span>
  );
}
