/**
 * Where the cockpit's instruments draw a direction from the ship, in camera space (x right,
 * y up, −z ahead): a marker on the screen, and a blip on the scanner disc. Pure, so the
 * geometry is tested without a DOM.
 */

/** A marker on the screen: normalised −1…1 across and up, or at the edge pointing the way. */
export type ScreenMark = {
  x: number;
  y: number;
  /** The direction is off the screen: the mark sits at the edge, turned `angle` radians. */
  off: boolean;
  angle: number;
};

/**
 * Places a direction on the screen for a camera with `tanHalf` (the tangent of half the
 * vertical field) and `aspect`. Off-screen directions, behind included, go to the edge at
 * `edge` of the half-size; the mark's angle then points out towards the direction.
 */
export function markOnScreen(
  x: number,
  y: number,
  z: number,
  tanHalf: number,
  aspect: number,
  edge: number,
  out: ScreenMark,
): ScreenMark {
  const behind = z >= 0;
  if (behind) {
    /* Behind: the direction's shadow on the screen, pushed out past the edge. */
    const len = Math.hypot(x, y) || 1;
    out.x = (-x / len) * 2;
    out.y = (-y / len) * 2;
  } else {
    out.x = x / -z / (tanHalf * aspect);
    out.y = y / -z / tanHalf;
  }
  out.off = behind || Math.abs(out.x) > edge || Math.abs(out.y) > edge;
  if (out.off) {
    const k = Math.max(Math.abs(out.x), Math.abs(out.y)) / edge;
    out.x /= k;
    out.y /= k;
    out.angle = Math.atan2(-out.y, out.x);
  } else out.angle = 0;
  return out;
}

/** A blip on the scanner: its foot on the disc (u right, w ahead, −1…1) and its height above it. */
export type Blip = {
  /** How far out, 0 (the ship) to 1 (the rim). */
  r: number;
  u: number;
  w: number;
  /** The share of the radius the blip stands above (or hangs below) the disc. */
  h: number;
};

/** Decades of distance from the ship's centre to the rim: the range ring sits at the middle. */
const SCANNER_DECADES = 4;

/**
 * Places a point on the scanner, the disc the ship's own plane: the distance reads in log
 * space, `range` (the aim's distance, km) on the middle ring, ten times farther on the ring
 * outside it; past a hundred times the blip sits on the rim, within a hundredth at the centre.
 */
export function blipOnScanner(x: number, y: number, z: number, range: number, out: Blip): Blip {
  const d = Math.hypot(x, y, z);
  if (!(d > 0) || !(range > 0)) {
    out.r = out.u = out.w = out.h = 0;
    return out;
  }
  const r = Math.min(1, Math.max(0, 0.5 + Math.log10(d / range) / SCANNER_DECADES));
  const flat = Math.hypot(x, z);
  out.r = r;
  out.u = flat > 0 ? (r * x) / d : 0;
  out.w = flat > 0 ? (r * -z) / d : 0;
  out.h = (r * y) / d;
  return out;
}
