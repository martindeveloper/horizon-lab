/**
 * Line drawings laid over the hole during guide beats, in scene units of M.
 * Geometry is real where it can be: coordinate radii, the critical curve this
 * camera sees, a Schwarzschild null geodesic, zero-angular-momentum Kerr infall and
 * a Keplerian ellipse. Builders are pure; the canvas layer only projects.
 */
import { eccentricAnomaly } from "@horizon/toolkit/bodies";
import { add3, scale3, smootherstep, TAU, type Vec3 } from "@horizon/toolkit/math";

import type { Basis } from "./frame";
import { criticalCurve } from "./kerr-rays";
import { B_CRIT, horizonOverM, iscoOverM, photonOverM } from "./physics";
import { pinRadius } from "./pins";

export type RingId = "horizon" | "photon" | "isco" | "ergo";

/** A ring animated in from another radius starts growing after this many seconds, and takes this long. */
const GROW_DELAY = 1.6;
const GROW_TIME = 3.4;

export type Sketch =
  /** Equatorial coordinate radii; `from` animates a ring in from another radius. */
  | { kind: "rings"; rings: RingId[]; from?: Partial<Record<RingId, number>> }
  /** Critical curve for the current spin and camera; `assumed` marks an unmeasured spin. */
  | { kind: "shadow"; assumed?: boolean }
  /** Orbital flow arrows on the approaching and receding sides. */
  | { kind: "flow" }
  /** Spin axis with the line of sight `angle` radians from it. */
  | { kind: "jet"; angle: number }
  /** Keplerian ellipse with focus at the hole; a dot keeps Kepler time. */
  | { kind: "orbit"; eccentricity: number; periapsis: number; tilt: number; name: string }
  /** A light path that winds once around the photon sphere (a = 0). */
  | { kind: "photon" }
  /** Zero-angular-momentum infall swept round by frame dragging. */
  | { kind: "drag" }
  /** A ruler of `length` M in kilometres for this mass. */
  | { kind: "ruler"; length: number };

export type Tone = "accent" | "quiet";
type Stroke = {
  points: Vec3[];
  tone: Tone;
  delay: number;
  duration: number;
  dashed?: boolean;
  arrow?: boolean;
  /** A travelling dot at the drawing tip. */
  head?: boolean;
  /** A dot at this world point, drawn once the stroke is complete. */
  marker?: Vec3;
};
type Label = { at: Vec3; text: string; tone: Tone; delay: number; place: "right" | "above" };

/** Seconds a label takes to fade in after its delay. */
export const LABEL_FADE = 0.6;

export type SketchContext = {
  spin: number;
  /** Schwarzschild radius 2M in kilometres. */
  rsKm: number;
  elapsed: number;
  /** Camera frame now, for drawings that face the viewer. */
  live: Basis;
  /** Camera frame when the beat landed, for drawings fixed in the scene. */
  anchor: Basis;
  /** Camera distance from the hole in M. */
  distance: number;
  number: (n: number, digits: number) => string;
  km: (km: number) => string;
  notToScale: string;
  /** Marks a drawing computed for a non-spinning hole. */
  spinZero: string;
  /** Marks a real object's spin as a model value. */
  assumedSpin: string;
  /** Names the shadow drawing as theory, not this image's dark edge. */
  criticalCurve: string;
};

/** The point x u + y v. */
const inPlane = (u: Vec3, v: Vec3, x: number, y: number): Vec3 => add3(scale3(u, x), scale3(v, y));

/** Ring point at parameter t, matching `ringPoints`: (r sin t, 0, r cos t). */
const ringAt = (r: number, t: number): Vec3 => [r * Math.sin(t), 0, r * Math.cos(t)];
/** Ring parameter of a horizontal direction. Gas flows toward decreasing t. */
const heading = (v: Vec3) => Math.atan2(v[0], v[2]);

function arc(r: number, t0: number, t1: number, n = 96): Vec3[] {
  const pts: Vec3[] = [];
  for (let i = 0; i <= n; i++) pts.push(ringAt(r, t0 + ((t1 - t0) * i) / n));
  return pts;
}

/** Relative step to which the critical curve's camera distance and inclination are rounded. */
const CURVE_QUANTUM = 1e-3;
let curveCache: { key: string; curve: [number, number][] } | null = null;

/**
 * The critical curve in the camera's tangent plane, scaled to M at the hole. It depends on the
 * spin and the camera's distance and inclination, not its azimuth (the hole is symmetric about
 * its axis and the camera does not roll), so one curve serves an orbiting camera; with the
 * distance and the inclination's cosine rounded to `CURVE_QUANTUM` (under a tenth of a pixel)
 * it also serves one that drifts.
 */
function shadowCurve(spin: number, distance: number, cosPolar: number) {
  const d = Math.exp(Math.round(Math.log(distance) / CURVE_QUANTUM) * CURVE_QUANTUM);
  const mu = Math.round(cosPolar / CURVE_QUANTUM) * CURVE_QUANTUM;
  const key = `${spin}:${d}:${mu}`;
  if (curveCache?.key !== key) {
    // The camera at azimuth 0 and its roll-free frame (`orbitBasis` there).
    const sin = Math.sqrt(Math.max(1 - mu * mu, 0));
    const basis: Basis = { right: [1, 0, 0], up: [0, sin, -mu], fwd: [0, -mu, -sin] };
    const curve = criticalCurve(spin, scale3(basis.fwd, -d), basis).map(
      ([x, y]): [number, number] => [x * d, y * d],
    );
    curveCache = { key, curve };
  }
  return curveCache.curve;
}

/**
 * Apparent size of the a = 0 shadow at camera distance d, as a world radius at
 * the hole: sin α = (3√3 M / d) √(1 − 2M/d), re-expressed for a flat projection.
 */
export function shadowScale(distance: number) {
  const d = Math.max(distance, 3.2);
  const s = Math.min(0.98, (B_CRIT / d) * Math.sqrt(1 - 2 / d));
  return (d * Math.tan(Math.asin(s))) / B_CRIT;
}

/** Schwarzschild null geodesic in its orbital plane, entering from r = 40 M. */
const PHOTON_PATH: [number, number][] = (() => {
  const b = B_CRIT * 1.001;
  const r0 = 40;
  let u = 1 / r0;
  let du = Math.sqrt(1 / (b * b) - u * u + 2 * u ** 3);
  const f = (x: number) => -x + 3 * x * x;
  const h = 0.006;
  const pts: [number, number][] = [];
  for (let phi = 0; phi < 30; phi += h) {
    if (Math.round(phi / h) % 4 === 0) pts.push([Math.cos(phi) / u, Math.sin(phi) / u]);
    const k1u = du;
    const k1v = f(u);
    const k2u = du + (h / 2) * k1v;
    const k2v = f(u + (h / 2) * k1u);
    const k3u = du + (h / 2) * k2v;
    const k3v = f(u + (h / 2) * k2u);
    const k4u = du + h * k3v;
    const k4v = f(u + h * k3u);
    u += (h / 6) * (k1u + 2 * k2u + 2 * k3u + k4u);
    du += (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
    if (u < 1 / r0 && du < 0) break;
  }
  return pts;
})();

/**
 * Equatorial Kerr infall with E = 1, L = 0: dφ/dr = −2ar / (Δ √(2r(r² + a²))).
 * Returns (r, φ) pairs from r0 inward to just outside the horizon.
 */
export function dragStreamline(a: number, r0 = 9, n = 140): [number, number][] {
  const rEnd = horizonOverM(a) * 1.14;
  const pts: [number, number][] = [];
  let phi = 0;
  let r = r0;
  const dr = (r0 - rEnd) / n;
  const rate = (x: number) => {
    const delta = x * x - 2 * x + a * a;
    return (2 * a * x) / (delta * Math.sqrt(2 * x * (x * x + a * a)));
  };
  for (let i = 0; i <= n; i++) {
    pts.push([r, phi]);
    // Midpoint step: the rate climbs steeply toward the horizon.
    phi += rate(r - dr / 2) * dr;
    r -= dr;
  }
  return pts;
}

/**
 * Special-relativistic Doppler factor δ = 1 / (γ (1 ∓ v sin i)) at the two limbs
 * of a prograde circular orbit, with the orbital speed v measured by a
 * zero-angular-momentum observer (Bardeen, Press & Teukolsky 1972). Light
 * bending and gravitational redshift are left out: δ is the beaming factor only.
 */
function limbDoppler(r: number, a: number, inclination: number): [number, number] {
  const delta = r * r - 2 * r + a * a;
  const v = (r * r - 2 * a * Math.sqrt(r) + a * a) / (Math.sqrt(delta) * (r ** 1.5 + a));
  const gamma = 1 / Math.sqrt(1 - v * v);
  const los = v * Math.sin(inclination);
  return [1 / (gamma * (1 - los)), 1 / (gamma * (1 + los))];
}

function ringRadius(id: RingId, spin: number) {
  if (id === "horizon") return horizonOverM(spin);
  if (id === "photon") return photonOverM(spin);
  if (id === "isco") return iscoOverM(spin);
  return 2;
}
const RING_SYMBOL: Record<RingId, string> = {
  horizon: "r₊",
  photon: "r_ph",
  isco: "r_ISCO",
  ergo: "r_E",
};

/** Enough digits to show the spin as set: 0, 0.82, 0.998. */
function spinDigits(a: number) {
  for (let d = 0; d < 3; d++) if (Math.abs(a * 10 ** d - Math.round(a * 10 ** d)) < 1e-6) return d;
  return 3;
}

function trimmed(c: SketchContext, n: number) {
  const digits = Math.abs(n - Math.round(n)) < 0.005 ? 0 : 2;
  return c.number(n, digits);
}

/** A drawing, and the elapsed seconds from which it no longer changes with time. */
type Drawing = { strokes: Stroke[]; labels: Label[]; still: number };
type Builder<Kind extends Sketch["kind"]> = (
  s: Extract<Sketch, { kind: Kind }>,
  c: SketchContext,
  out: Drawing,
) => void;

/** One builder per drawing; each adds its strokes and labels to the beat's drawing. */
const BUILDERS: { [Kind in Sketch["kind"]]: Builder<Kind> } = {
  rings: (s, c, out) => {
    const { strokes, labels } = out;
    const { live } = c;
    s.rings.forEach((id, i) => {
      const to = ringRadius(id, c.spin);
      const from = s.from?.[id];
      let r = to;
      if (from !== undefined) {
        strokes.push({
          points: arc(from, 0, TAU, 128),
          tone: "quiet",
          dashed: true,
          delay: 0,
          duration: 1.6,
        });
        labels.push({
          at: scale3(live.right, -from),
          text: `${trimmed(c, from)}M`,
          tone: "quiet",
          delay: 1.2,
          place: "above",
        });
        r = from + (to - from) * smootherstep((c.elapsed - GROW_DELAY) / GROW_TIME);
        out.still = Math.max(out.still, GROW_DELAY + GROW_TIME);
      }
      const delay = 0.25 + i * 0.55;
      strokes.push({
        points: arc(r, 0, TAU, 128),
        tone: id === "horizon" ? "accent" : "quiet",
        delay,
        duration: 1.8,
      });
      labels.push({
        at: scale3(live.right, r),
        // With spin, photon orbit and ISCO differ by direction; these follow the disk's.
        text: `${RING_SYMBOL[id]}${c.spin !== 0 && (id === "photon" || id === "isco") ? (c.spin > 0 ? ",pro" : ",retro") : ""} = ${trimmed(c, r)}M`,
        tone: id === "horizon" ? "accent" : "quiet",
        delay: delay + 1.2,
        place: "right",
      });
    });
  },
  shadow: (s, c, { strokes, labels }) => {
    const { live } = c;
    // Photons from the spherical photon orbits, as this camera receives them.
    const curve = shadowCurve(c.spin, c.distance, -live.fwd[1]);
    const points = curve.map(([x, y]) => inPlane(live.right, live.up, x, y));
    strokes.push({ points, tone: "accent", delay: 0.2, duration: 2.6 });
    let minX = Infinity;
    let maxX = -Infinity;
    let top = 0;
    for (const [x, y] of curve) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      top = Math.max(top, y);
    }
    // A diameter, beside rings labelled by radius, and for this scene's spin.
    labels.push({
      at: inPlane(live.right, live.up, 0, top + 0.6),
      text: `${c.criticalCurve} · ⌀ ≈ ${c.number(maxX - minX, 1)}M · a = ${c.number(c.spin, spinDigits(c.spin))}`,
      tone: "accent",
      delay: 2.2,
      place: "above",
    });
    if (s.assumed)
      labels.push({
        at: inPlane(live.right, live.up, 0, top + 0.6),
        text: c.assumedSpin,
        tone: "quiet",
        delay: 2.6,
        place: "above",
      });
  },
  flow: (s, c, { strokes, labels }) => {
    const { live } = c;
    const R = pinRadius("doppler", c.spin);
    const near = heading(live.right);
    const far = near + Math.PI;
    const [ahead, behind] = limbDoppler(R, c.spin, Math.acos(Math.min(1, Math.abs(live.fwd[1]))));
    strokes.push({
      points: arc(R, near + 0.6, near - 0.6, 48),
      tone: "accent",
      arrow: true,
      delay: 0.2,
      duration: 1.8,
    });
    strokes.push({
      points: arc(R, far + 0.6, far - 0.6, 48),
      tone: "quiet",
      arrow: true,
      delay: 0.7,
      duration: 1.8,
    });
    labels.push({
      at: ringAt(R * 1.08, near),
      text: `δ ≈ ${c.number(ahead, 2)}`,
      tone: "accent",
      delay: 1.6,
      place: "right",
    });
    labels.push({
      at: ringAt(R * 1.08, far),
      text: `δ ≈ ${c.number(behind, 2)}`,
      tone: "quiet",
      delay: 2.1,
      place: "above",
    });
  },
  jet: (s, c, { strokes, labels }) => {
    const { anchor } = c;
    const H = 30;
    const side = scale3(anchor.right, -1);
    strokes.push({
      points: [
        [0, -H * 0.6, 0],
        [0, 0, 0],
      ],
      tone: "quiet",
      dashed: true,
      delay: 0,
      duration: 1.2,
    });
    strokes.push({
      points: [
        [0, 0, 0],
        [0, H, 0],
      ],
      tone: "quiet",
      arrow: true,
      delay: 0.3,
      duration: 2,
    });
    const dir = inPlane([0, 1, 0], side, Math.cos(s.angle), Math.sin(s.angle));
    const earth = scale3(dir, H * 0.82);
    strokes.push({
      points: [[0, 0, 0], earth],
      tone: "accent",
      dashed: true,
      delay: 1.4,
      duration: 2,
      marker: earth,
    });
    const swing: Vec3[] = [];
    for (let i = 0; i <= 24; i++) {
      const q = (s.angle * i) / 24;
      swing.push(inPlane([0, 1, 0], side, 12 * Math.cos(q), 12 * Math.sin(q)));
    }
    strokes.push({ points: swing, tone: "accent", delay: 2.6, duration: 1 });
    labels.push({ at: earth, text: "⊕", tone: "accent", delay: 3.2, place: "above" });
    labels.push({
      at: inPlane([0, 1, 0], side, 13, 13 * Math.sin(s.angle) * 1.6),
      text: `i ≈ ${Math.round((s.angle * 180) / Math.PI)}°`,
      tone: "accent",
      delay: 3.4,
      place: "right",
    });
  },
  orbit: (s, c, out) => {
    const { strokes, labels } = out;
    const { anchor } = c;
    const e = s.eccentricity;
    const a = s.periapsis / (1 - e);
    const p = a * (1 - e * e);
    const P = anchor.right;
    const Q = inPlane(anchor.up, anchor.fwd, Math.cos(s.tilt), -Math.sin(s.tilt));
    const at = (nu: number) =>
      inPlane(
        P,
        Q,
        (p / (1 + e * Math.cos(nu))) * Math.cos(nu),
        (p / (1 + e * Math.cos(nu))) * Math.sin(nu),
      );
    const points: Vec3[] = [];
    for (let i = 0; i <= 220; i++) {
      // Denser near pericentre, where the curve bends hardest.
      const nu = Math.PI * (2 * (i / 220) - 1) * (0.55 + 0.45 * Math.abs(2 * (i / 220) - 1));
      points.push(at(nu));
    }
    strokes.push({ points, tone: "quiet", delay: 0.2, duration: 3 });
    // Kepler time: 14 s per loop, starting just after apocentre; it never comes to rest.
    out.still = Infinity;
    const mean = ((((c.elapsed - 1) / 14) % 1) + 1) % 1;
    const E = eccentricAnomaly(TAU * mean + Math.PI, e);
    const nu =
      2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    strokes.push({
      points: [at(nu), at(nu)],
      tone: "accent",
      delay: 1,
      duration: 0.01,
      marker: at(nu),
    });
    labels.push({
      at: at(0),
      text: `${s.name} · e = ${c.number(e, 2)}`,
      tone: "accent",
      delay: 2.4,
      place: "right",
    });
    labels.push({
      at: add3(at(0), scale3(Q, -3.2)),
      text: c.notToScale,
      tone: "quiet",
      delay: 2.8,
      place: "right",
    });
  },
  photon: (s, c, { strokes, labels }) => {
    const { anchor } = c;
    const u = anchor.right;
    const v = anchor.up;
    const start = Math.PI + 0.3;
    const cos = Math.cos(start);
    const sin = Math.sin(start);
    const points = PHOTON_PATH.map(([x, y]) => inPlane(u, v, x * cos - y * sin, x * sin + y * cos));
    const circle: Vec3[] = [];
    for (let i = 0; i <= 96; i++)
      circle.push(inPlane(u, v, 3 * Math.cos((TAU * i) / 96), 3 * Math.sin((TAU * i) / 96)));
    strokes.push({ points: circle, tone: "quiet", dashed: true, delay: 0, duration: 1.4 });
    strokes.push({ points, tone: "accent", head: true, arrow: true, delay: 0.9, duration: 5.2 });
    labels.push({
      at: inPlane(u, v, 2.3, 2.3),
      text: "r_ph = 3M",
      tone: "quiet",
      delay: 1.2,
      place: "right",
    });
    labels.push({
      at: inPlane(u, v, 2.3, 2.3),
      text: c.spinZero,
      tone: "quiet",
      delay: 1.4,
      place: "right",
    });
  },
  drag: (s, c, { strokes, labels }) => {
    const { live } = c;
    const r0 = 9;
    const line = dragStreamline(c.spin, r0);
    const base = heading(live.right);
    for (let k = 0; k < 6; k++) {
      const t0 = base + (TAU * k) / 6;
      strokes.push({
        points: line.map(([r, phi]) => ringAt(r, t0 - phi)),
        tone: "accent",
        arrow: true,
        delay: 1 + k * 0.18,
        duration: 3.4,
      });
    }
    const rh = horizonOverM(c.spin);
    strokes.push({
      points: arc(2, 0, TAU, 128),
      tone: "quiet",
      dashed: true,
      delay: 0,
      duration: 1.4,
    });
    strokes.push({ points: arc(rh, 0, TAU, 96), tone: "quiet", delay: 0.4, duration: 1.2 });
    labels.push({
      at: scale3(live.right, 2),
      text: "r_E = 2M",
      tone: "quiet",
      delay: 1.2,
      place: "right",
    });
  },
  ruler: (s, c, { strokes, labels }) => {
    const { live } = c;
    const L = s.length;
    const y = -(B_CRIT * shadowScale(c.distance) + 2.2);
    strokes.push({
      points: [inPlane(live.right, live.up, -L / 2, y), inPlane(live.right, live.up, L / 2, y)],
      tone: "accent",
      delay: 0.2,
      duration: 1.4,
    });
    for (let i = 0; i <= L; i++) {
      const h = i % 5 === 0 ? 0.7 : 0.35;
      const x = -L / 2 + i;
      strokes.push({
        points: [inPlane(live.right, live.up, x, y), inPlane(live.right, live.up, x, y + h)],
        tone: i % 5 === 0 ? "accent" : "quiet",
        delay: 0.2 + (1.4 * i) / L,
        duration: 0.2,
      });
    }
    labels.push({
      at: inPlane(live.right, live.up, 0, y - 1.6),
      text: `${L} M ≈ ${c.km((c.rsKm * L) / 2)}`,
      tone: "accent",
      delay: 1.6,
      place: "above",
    });
  },
};

export function buildSketch(s: Sketch, c: SketchContext): Drawing {
  const out: Drawing = { strokes: [], labels: [], still: 0 };
  // Each case narrows s to its builder's kind; a lookup by s.kind would not.
  switch (s.kind) {
    case "rings":
      BUILDERS.rings(s, c, out);
      break;
    case "shadow":
      BUILDERS.shadow(s, c, out);
      break;
    case "flow":
      BUILDERS.flow(s, c, out);
      break;
    case "jet":
      BUILDERS.jet(s, c, out);
      break;
    case "orbit":
      BUILDERS.orbit(s, c, out);
      break;
    case "photon":
      BUILDERS.photon(s, c, out);
      break;
    case "drag":
      BUILDERS.drag(s, c, out);
      break;
    case "ruler":
      BUILDERS.ruler(s, c, out);
      break;
  }
  for (const stroke of out.strokes) out.still = Math.max(out.still, stroke.delay + stroke.duration);
  for (const label of out.labels) out.still = Math.max(out.still, label.delay + LABEL_FADE);
  return out;
}
