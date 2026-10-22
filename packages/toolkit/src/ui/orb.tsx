import type { CSSProperties } from "react";

import { cn } from "./utils";

/**
 * How an orb shines: `lit` a sphere lit from the upper left (a planet, a moon), `glow` its own
 * light (a star), `hole` a black disc in a gold ring (a horizon), `swarm` a dotted ring (a belt,
 * a cloud, a boundary), `haze` a tilted spread of light (a galaxy, a cluster).
 */
export type OrbLook = "lit" | "glow" | "hole" | "swarm" | "haze";

export type OrbProps = {
  /** The body's colour, any CSS colour; the quiet foreground when not given. */
  color?: string | undefined;
  look?: OrbLook;
  /** Diameter, px. */
  size?: number | undefined;
  className?: string;
};

/** An orb's diameter in a list row, px. */
const ORB_PX = 12;

/** A body's small mark in its own colour, beside its name in a list or legend. Decorative. */
export function Orb({ color, look = "lit", size = ORB_PX, className }: OrbProps) {
  return (
    <span
      aria-hidden
      data-look={look}
      className={cn("orb", className)}
      style={{ "--orb": color, width: size, height: size } as CSSProperties}
    />
  );
}
