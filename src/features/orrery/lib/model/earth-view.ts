/**
 * The view from Earth: the camera turns about Earth instead of the Sun, and each body trails
 * the path it has drawn across Earth's sky, the loops Ptolemy's epicycles stood for and Tycho's
 * Sun-about-Earth with the planets about the Sun. A trail is the orbit the scene draws with
 * Earth's own position taken away; nothing is typed in.
 */
import { planetElements } from "@/space/solar-system/model/elements";
import { isPresentEra } from "@/space/solar-system/model/moment";
import {
  PLANET_IDS,
  keplerPosition,
  type Elements,
  type PlanetId,
  type Vec3,
} from "@horizon/toolkit/bodies";

/** What trails: the Sun and every planet but Earth, which is the centre. */
export type TrailId = "sun" | Exclude<PlanetId, "earth">;
export const TRAIL_IDS: readonly TrailId[] = [
  "sun",
  ...PLANET_IDS.filter((id): id is Exclude<PlanetId, "earth"> => id !== "earth"),
];

/**
 * Years a trail reaches back: thirteen Venus years are eight of Earth's, so Venus's rose
 * closes, and Mars draws four loops. The Sun's circle and Mercury's loops lap the same track
 * every year, and would only pile up: theirs is one year.
 */
export const trailSpan = (id: TrailId) => (id === "sun" || id === "mercury" ? 1 : 8);
/** Points along a trail: a step of about three days on the long trails, fine for the loops. */
export const TRAIL_SAMPLES = 1024;
export const trailStep = (id: TrailId) => trailSpan(id) / TRAIL_SAMPLES;

/**
 * Earth is the centre: the switch is on, in the ephemeris's era, with the camera the visitor's
 * own (the guide and the drift fly their shots about the Sun).
 */
export function earthCentred(s: {
  show: { fromEarth: boolean };
  drift: string;
  guideOpen: boolean;
  yearsAgo: number;
}) {
  return s.show.fromEarth && s.drift === "off" && !s.guideOpen && isPresentEra(s.yearsAgo);
}

const el: Elements = { a: 0, e: 0, i: 0, omega: 0, node: 0, M: 0 };
const earth: Vec3 = [0, 0, 0];

/** Where Earth is on the clock, as the scene draws it (au, scene axes). */
export function earthAt(mig: number, driftYears: number, now: Date, out: Vec3): Vec3 {
  return keplerPosition(planetElements("earth", mig, driftYears, now, el), out);
}

/** A body's place seen from Earth on the clock (au, scene axes): its position less Earth's. */
export function trailPoint(
  id: TrailId,
  mig: number,
  driftYears: number,
  now: Date,
  out: Vec3,
): Vec3 {
  earthAt(mig, driftYears, now, earth);
  if (id === "sun") {
    out[0] = out[1] = out[2] = 0;
  } else {
    keplerPosition(planetElements(id, mig, driftYears, now, el), out);
  }
  out[0] -= earth[0];
  out[1] -= earth[1];
  out[2] -= earth[2];
  return out;
}

/** A trail's point at a clock, written into `out`. */
export type TrailSampler = (driftYears: number, out: Vec3) => Vec3;

/**
 * A trail's samples at each `step` of the clock, kept in a ring. `advance` brings it to a
 * clock: one new sample per step passed, or every sample anew on the first call, a jump back
 * or a jump past the whole span. `read` writes the samples oldest first.
 */
export function createTrailRing(step: number, samples = TRAIL_SAMPLES) {
  const ring = new Float32Array(samples * 3);
  const at: Vec3 = [0, 0, 0];
  /** The newest sample's slot, and the step of the clock it was taken at. */
  let head = 0;
  let headStep = NaN;
  const write = (slot: number, point: Vec3) => {
    ring[slot * 3] = point[0];
    ring[slot * 3 + 1] = point[1];
    ring[slot * 3 + 2] = point[2];
  };
  return {
    advance(driftYears: number, sample: TrailSampler) {
      const to = Math.floor(driftYears / step);
      const behind = to - headStep;
      if (!(behind >= 0 && behind < samples)) {
        for (let j = samples - 1; j >= 0; j -= 1) {
          write(samples - 1 - j, sample((to - j) * step, at));
        }
        head = samples - 1;
      } else {
        for (let s = headStep + 1; s <= to; s += 1) {
          head = (head + 1) % samples;
          write(head, sample(s * step, at));
        }
      }
      headStep = to;
    },
    /** Writes the samples into `positions`, oldest first, `samples` points from its start. */
    read(positions: Float32Array) {
      for (let k = 0; k < samples; k += 1) {
        const slot = (head + 1 + k) % samples;
        positions[k * 3] = ring[slot * 3]!;
        positions[k * 3 + 1] = ring[slot * 3 + 1]!;
        positions[k * 3 + 2] = ring[slot * 3 + 2]!;
      }
    },
  };
}

/** How far a body's trail reaches from Earth, nearest and farthest (au), for the framing rule. */
export function trailReach(id: TrailId, mig: number, now: Date): { near: number; far: number } {
  const a = id === "sun" ? 1 : planetElements(id, mig, 0, now, el).a;
  return { near: Math.abs(a - 1), far: a + 1 };
}
