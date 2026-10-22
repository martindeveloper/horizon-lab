/** The Orrery's views are the solar system's framings; here the default, and drift by scale. */
/* Relative, not `@/`: routing.ts reaches this file from next.config.ts, which resolves no path aliases. */
import type { SolarViewId } from "../../../../space/solar-system/model/views";
import { orreryManifest } from "../../manifest";

export const DEFAULT_VIEW: SolarViewId = orreryManifest.routes.defaultId;

/** Along-orbit speed-up steps: up to each camera distance (au), model years per real second. */
const DRIFT_STEPS: readonly (readonly [number, number])[] = [
  [12, 0.35],
  [100, 2.5],
  [400, 12],
  [6_000, 80],
  [80_000, 2_000],
  [Infinity, 30_000],
];
/** Half-width of the blend across each step, in e-folds of distance. */
const DRIFT_BLEND = 0.3;

/**
 * Along-orbit speed-up, in model years per real second, by camera distance. Each step's
 * rate holds across its range and blends geometrically into the next over a short span
 * around the edge, so zooming never jolts the motion.
 */
export function driftYearsPerSecond(camDist: number) {
  const x = Math.log(Math.max(1e-9, camDist));
  for (let i = 0; i < DRIFT_STEPS.length - 1; i += 1) {
    const [edge, rate] = DRIFT_STEPS[i]!;
    const gap = x - Math.log(edge);
    if (gap > DRIFT_BLEND) continue;
    if (gap < -DRIFT_BLEND) return rate;
    const t = (gap + DRIFT_BLEND) / (2 * DRIFT_BLEND);
    const next = DRIFT_STEPS[i + 1]![1];
    return Math.exp(Math.log(rate) + (Math.log(next) - Math.log(rate)) * t * t * (3 - 2 * t));
  }
  return DRIFT_STEPS[DRIFT_STEPS.length - 1]![1];
}
