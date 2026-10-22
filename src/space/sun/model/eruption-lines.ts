/**
 * Extrude the single reconnection cross-section along the neutral line, then project it
 * onto the Sun. Closed upper contours are a 2D magnetic-island representation; this does
 * not assert that a real three-dimensional CME has disconnected from the photosphere.
 */
import type { Vec3 } from "@horizon/toolkit/math";

import type { EruptionLine, Region } from "./contract";
import { PLANE_LINE_POINTS, type PlaneLine } from "./eruption";
import { bipoleAxis, surfacePoint } from "./field";
import { ARCADE_LENGTH, ARCADE_SLICES, ERUPTION_SCALE_R, TEMPERATURES } from "./parameters";

export const blankEruptionLine = (): EruptionLine => ({
  points: new Float32Array(3 * PLANE_LINE_POINTS),
  count: 0,
  polarity: 1,
  open: false,
  strength: 1,
  kelvin: TEMPERATURES.activeRegion,
  kind: "arcade",
  slice: 0,
  strand: 0,
});

const up: Vec3 = [0, 0, 0];
const across: Vec3 = [0, 0, 0];
const along: Vec3 = [0, 0, 0];

export function eruptionBasis(region: Region) {
  surfacePoint(region.lat, region.lon, up);
  bipoleAxis(region, across);
  along[0] = up[1] * across[2] - up[2] * across[1];
  along[1] = up[2] * across[0] - up[0] * across[2];
  along[2] = up[0] * across[1] - up[1] * across[0];
}

/** Common local-to-solar mapping for the contours and plasma flow markers. */
export function eruptionPoint(out: Float32Array, offset: number, x: number, y: number, z: number) {
  const dx = up[0] + ERUPTION_SCALE_R * (x * across[0] + z * along[0]);
  const dy = up[1] + ERUPTION_SCALE_R * (x * across[1] + z * along[1]);
  const dz = up[2] + ERUPTION_SCALE_R * (x * across[2] + z * along[2]);
  const scale = (1 + y * ERUPTION_SCALE_R) / Math.hypot(dx, dy, dz);
  out[offset] = dx * scale;
  out[offset + 1] = dy * scale;
  out[offset + 2] = dz * scale;
}

export function eruptionLines(
  region: Region,
  plane: readonly PlaneLine[],
  planeCount: number,
  out: EruptionLine[],
) {
  eruptionBasis(region);
  const halfLength = (ARCADE_LENGTH * region.size) / (2 * ERUPTION_SCALE_R);
  let used = 0;
  for (let slice = 0; slice < ARCADE_SLICES; slice++) {
    const z = ((2 * slice) / (ARCADE_SLICES - 1) - 1) * halfLength;
    for (let i = 0; i < planeCount && used < out.length; i++) {
      const source = plane[i]!;
      const line = out[used++]!;
      for (let j = 0; j < source.count; j++)
        eruptionPoint(line.points, 3 * j, source.points[2 * j]!, source.points[2 * j + 1]!, z);
      line.count = source.count;
      line.polarity = region.polarity;
      line.open = false;
      line.strength = region.strength;
      // Prescribed emission proxies: the kinematic model does not solve heating or cooling.
      line.kelvin = source.kind === "postflare" ? TEMPERATURES.flare : TEMPERATURES.activeRegion;
      line.kind = source.kind;
      line.slice = slice;
      line.strand = source.strand;
    }
  }
  return used;
}
