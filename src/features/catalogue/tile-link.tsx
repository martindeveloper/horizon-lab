"use client";

import { Link } from "@/i18n/navigation";
import type { SimulationPath } from "@/lib/simulation-paths";

/**
 * A hidden pointer target that opens the simulation. It never takes focus, not
 * even from a click, so it can stay hidden from assistive technology; the
 * visible link in the panel is the one keyboard and screen-reader users reach.
 */
export function TileLink({ href, className }: { href: SimulationPath; className: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      aria-hidden
      tabIndex={-1}
      onMouseDown={(event) => event.preventDefault()}
      className={className}
    />
  );
}
