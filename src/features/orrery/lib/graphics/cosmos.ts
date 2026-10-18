/**
 * Point clouds for the cosmic map, in millions of light-years (Galaxy-model axes, see
 * `model/cosmos.ts`). Named galaxies and clusters sit at measured places; the galaxies around
 * them are a seeded sketch shaped like each structure:
 *
 * - the Local Group: dwarfs gathered round the Milky Way and Andromeda, a few loose;
 * - the Local Sheet: the nearby groups (M81, Centaurus A, Sculptor and smaller ones) in a
 *   thin slab ~46 Mly across in the supergalactic plane;
 * - clusters: concentrated balls (NFW-like), ellipticals toward the core;
 * - the Virgo Supercluster: clouds and spurs that fan out from Virgo in the plane, one of
 *   them through the Local Group;
 * - Laniakea: filaments that run in from its edge and converge on the Great Attractor,
 *   with flow lines along them, as in the Cosmicflows map of peculiar velocities.
 */
import { BufferAttribute, BufferGeometry, Color } from "three";

import { lcg } from "@horizon/toolkit/math";

import {
  SUPERGALACTIC,
  anchorById,
  anchorToday,
  fromSupergalactic,
  type AnchorId,
  type Vec,
} from "../model/cosmos";

type Rnd = () => number;
const gaussOf = (rnd: Rnd) => () => {
  const u = Math.max(1e-6, rnd());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * rnd());
};

const SPIRAL = new Color("#c9d6ff");
const ELLIPTICAL = new Color("#ffdcae");
const DWARF = new Color("#b9c2d6");
const mix = new Color();

type Writer = { pos: Float32Array; col: Float32Array; n: number };
const writer = (count: number): Writer => ({
  pos: new Float32Array(count * 3),
  col: new Float32Array(count * 3),
  n: 0,
});
function put(w: Writer, x: number, y: number, z: number, c: Color, brightness: number) {
  if (w.n * 3 >= w.pos.length) return;
  const i = w.n * 3;
  w.pos[i] = x;
  w.pos[i + 1] = y;
  w.pos[i + 2] = z;
  w.col[i] = c.r * brightness;
  w.col[i + 1] = c.g * brightness;
  w.col[i + 2] = c.b * brightness;
  w.n += 1;
}
function geometryOf(w: Writer) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(w.pos.subarray(0, w.n * 3), 3));
  geometry.setAttribute("color", new BufferAttribute(w.col.subarray(0, w.n * 3), 3));
  return geometry;
}

/** A point in supergalactic coordinates (Mly) added to `w`, converted to model axes. */
function putSg(w: Writer, x: number, y: number, z: number, c: Color, brightness: number) {
  const v = fromSupergalactic(x, y, z);
  put(w, v[0], v[1], v[2], c, brightness);
}
const toSg = (v: Readonly<Vec>): Vec => {
  const { x, y, z } = SUPERGALACTIC;
  return [
    v[0] * x[0] + v[1] * x[1] + v[2] * x[2],
    v[0] * y[0] + v[1] * y[1] + v[2] * y[2],
    v[0] * z[0] + v[1] * z[1] + v[2] * z[2],
  ];
};
const sgOf = (id: AnchorId) => toSg(anchorToday(anchorById(id)));

/** A random direction scaled to radius r. */
function onSphere(rnd: Rnd, r: number): Vec {
  const u = rnd() * 2 - 1;
  const t = rnd() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return [s * Math.cos(t) * r, s * Math.sin(t) * r, u * r];
}

/** Radius inside a concentrated ball (projected NFW-like): dense core, long tail to `max`. */
const ballRadius = (rnd: Rnd, core: number, max: number) => {
  const u = rnd();
  return Math.min(max, (core * u) / Math.max(0.05, 1 - u * 0.92));
};

/** A galaxy's colour and brightness: ellipticals toward a cluster core, dwarfs faint. */
function tint(rnd: Rnd, coreShare: number) {
  const elliptical = rnd() < coreShare;
  const giant = rnd() < 0.12;
  mix.copy(elliptical ? ELLIPTICAL : SPIRAL).lerp(DWARF, giant ? 0 : 0.5);
  return { color: mix, brightness: giant ? 0.95 + rnd() * 0.3 : 0.35 + rnd() * 0.35 };
}

/** One group of galaxies, Gaussian around a supergalactic point. */
function group(w: Writer, rnd: Rnd, centre: Vec, count: number, sigma: number, flat = 1) {
  const gauss = gaussOf(rnd);
  for (let i = 0; i < count; i += 1) {
    const { color, brightness } = tint(rnd, 0.25);
    putSg(
      w,
      centre[0] + gauss() * sigma,
      centre[1] + gauss() * sigma,
      centre[2] + gauss() * sigma * flat,
      color,
      brightness,
    );
  }
}

const scaled = (tight: boolean) => (count: number) => Math.round(count * (tight ? 0.6 : 1));

/**
 * The Local Group's dwarfs: those bound to the Milky Way (with the Magellanic Clouds) and the
 * loose ones, around the galactic centre; Andromeda's own, around Andromeda.
 */
export function localGroupClouds(tight: boolean) {
  const size = scaled(tight);
  const rnd = lcg(41);
  const local = writer(size(70));
  const andromeda = writer(size(50));
  const m31 = anchorToday(anchorById("andromeda"));
  const satellites = (w: Writer, count: number, reach: number, origin: Vec) => {
    for (let i = 0; i < count; i += 1) {
      const r = 0.04 + ballRadius(rnd, 0.12, reach);
      const [x, y, z] = onSphere(rnd, r);
      put(w, origin[0] + x, origin[1] + y, origin[2] + z, DWARF, 0.55 + rnd() * 0.45);
    }
  };
  satellites(local, size(40), 0.9, [0, 0, 0]);
  satellites(andromeda, size(46), 1, [0, 0, 0]);
  /* The Magellanic Clouds, brighter than the rest. */
  for (const id of ["lmc", "smc"] as const) {
    const p = anchorToday(anchorById(id));
    put(local, p[0], p[1], p[2], SPIRAL, id === "lmc" ? 1.3 : 1);
  }
  /* Loose members out to the zero-velocity surface, ~1 Mpc from the mass centre. */
  const centre: Vec = [m31[0] * 0.55, m31[1] * 0.55, m31[2] * 0.55];
  for (let i = 0; i < size(24); i += 1) {
    const [x, y, z] = onSphere(rnd, 1.2 + rnd() * 2.8);
    put(local, centre[0] + x, centre[1] + y * 0.6, centre[2] + z, DWARF, 0.45 + rnd() * 0.35);
  }
  return { local: geometryOf(local), andromeda: geometryOf(andromeda) };
}

/**
 * The Local Sheet: the nearby groups in a thin slab about the supergalactic equator, 7 Mpc
 * (~23 Mly) in radius and ±1.5 Mpc (~±5 Mly) thick (Tully et al. 2008).
 */
export function localSheet(tight: boolean) {
  const size = scaled(tight);
  const rnd = lcg(53);
  const w = writer(size(520));
  for (const id of ["m81", "centaurusA", "sculptor"] as const)
    group(w, rnd, sgOf(id), size(36), 0.9, 0.7);
  for (let k = 0; k < 22; k += 1) {
    const r = 5 + Math.sqrt(rnd()) * 17;
    const t = rnd() * Math.PI * 2;
    const centre: Vec = [Math.cos(t) * r, Math.sin(t) * r, gaussOf(rnd)() * 2];
    group(w, rnd, centre, size(4 + Math.floor(rnd() * 12)), 0.6 + rnd() * 0.7, 0.6);
  }
  const gauss = gaussOf(rnd);
  for (let i = 0; i < size(90); i += 1) {
    const r = 3 + Math.sqrt(rnd()) * 20;
    const t = rnd() * Math.PI * 2;
    const { color, brightness } = tint(rnd, 0.1);
    putSg(w, Math.cos(t) * r, Math.sin(t) * r, gauss() * 2.2, color, brightness * 0.8);
  }
  return geometryOf(w);
}

/**
 * A rich cluster around its own centre (Mly): `core` sets the concentration, `reach` the
 * outer edge. Members are written in a fixed random order, so a draw range of the first n
 * shows a cluster still gathering.
 */
export function clusterCloud(count: number, core: number, reach: number, seed: number) {
  const rnd = lcg(seed);
  const w = writer(count);
  for (let i = 0; i < count; i += 1) {
    const r = ballRadius(rnd, core, reach);
    const [x, y, z] = onSphere(rnd, r);
    const { color, brightness } = tint(rnd, Math.max(0.15, 0.85 - r / reach));
    put(w, x, y, z, color, brightness);
  }
  return geometryOf(w);
}

/** The Virgo Supercluster: spurs and clouds fanning out from Virgo in the supergalactic plane. */
export function localSupercluster(tight: boolean) {
  const size = scaled(tight);
  const rnd = lcg(67);
  const w = writer(size(3200));
  const virgo = sgOf("virgoCluster");
  const gauss = gaussOf(rnd);
  /* One spur runs from Virgo through the Local Group and on past it. */
  const spurs: { to: Vec; groups: number }[] = [
    { to: [-virgo[0] * 0.25, -virgo[1] * 0.25, -virgo[2] * 0.25], groups: 14 },
  ];
  for (let k = 0; k < 7; k += 1) {
    const angle = (k / 7) * Math.PI * 2 + rnd() * 0.5;
    const reach = 30 + rnd() * 25;
    spurs.push({
      to: [
        virgo[0] + Math.cos(angle) * reach,
        virgo[1] + Math.sin(angle) * reach,
        virgo[2] + gauss() * 5,
      ],
      groups: 8 + Math.floor(rnd() * 8),
    });
  }
  for (const spur of spurs) {
    for (let g = 0; g < spur.groups; g += 1) {
      const t = (g + 0.5 + (rnd() - 0.5) * 0.6) / spur.groups;
      const centre: Vec = [
        virgo[0] + (spur.to[0] - virgo[0]) * t + gauss() * 2.5,
        virgo[1] + (spur.to[1] - virgo[1]) * t + gauss() * 2.5,
        virgo[2] + (spur.to[2] - virgo[2]) * t + gauss() * 1.5,
      ];
      group(w, rnd, centre, size(10 + Math.floor(rnd() * 26)), 0.8 + rnd() * 1.2, 0.7);
    }
  }
  /* A flattened field around Virgo, ~110 Mly across. */
  for (let i = 0; i < size(700); i += 1) {
    const r = Math.sqrt(rnd()) * 55;
    const t = rnd() * Math.PI * 2;
    const { color, brightness } = tint(rnd, 0.15);
    putSg(
      w,
      virgo[0] + Math.cos(t) * r,
      virgo[1] + Math.sin(t) * r,
      virgo[2] + gauss() * 6,
      color,
      brightness * 0.75,
    );
  }
  return geometryOf(w);
}

/**
 * Galaxies far behind the nearby ones, as directions on a unit sphere: most in loose clumps,
 * the rest spread evenly. Not a map of anything; the layer draws it far around the camera
 * until the real web of Laniakea takes over.
 */
export function deepField(tight: boolean) {
  const size = scaled(tight);
  const rnd = lcg(97);
  const gauss = gaussOf(rnd);
  const count = size(2400);
  const w = writer(count);
  const clumps = Array.from({ length: 48 }, () => onSphere(rnd, 1));
  for (let i = 0; i < count; i += 1) {
    let [x, y, z] = onSphere(rnd, 1);
    if (rnd() < 0.6) {
      const c = clumps[Math.floor(rnd() * clumps.length)]!;
      x = c[0] + gauss() * 0.06;
      y = c[1] + gauss() * 0.06;
      z = c[2] + gauss() * 0.06;
      const len = Math.hypot(x, y, z) || 1;
      x /= len;
      y /= len;
      z /= len;
    }
    const { color, brightness } = tint(rnd, 0.2);
    put(w, x, y, z, color, brightness * 0.8);
  }
  return geometryOf(w);
}

/** A point on a quadratic Bézier from a to c through control b. */
function bezier(a: Vec, b: Vec, c: Vec, t: number): Vec {
  const u = 1 - t;
  return [
    u * u * a[0] + 2 * u * t * b[0] + t * t * c[0],
    u * u * a[1] + 2 * u * t * b[1] + t * t * c[1],
    u * u * a[2] + 2 * u * t * b[2] + t * t * c[2],
  ];
}

const FLOW_STEPS = 28;
const FLOW_FAINT = new Color("#6f8796");
const FLOW_BRIGHT = new Color("#cfe2ec");

/**
 * Laniakea: filaments from its edge to the Great Attractor, galaxies strung along them, and
 * flow lines that follow them inward. The Local Supercluster's own spur joins at Centaurus.
 */
export function laniakeaWeb(tight: boolean) {
  const size = scaled(tight);
  const rnd = lcg(79);
  const gauss = gaussOf(rnd);
  const heart = sgOf("greatAttractor");
  const virgo = sgOf("virgoCluster");
  const centaurus = sgOf("centaurusCluster");
  const hydra = sgOf("hydraCluster");
  const starts: Vec[] = [virgo, hydra];
  for (let k = 0; k < (tight ? 26 : 38); k += 1) {
    const [x, y, z] = onSphere(rnd, 1);
    const r = 150 + rnd() * 120;
    /* Flatter than round, like the basin. */
    starts.push([heart[0] + x * r, heart[1] + y * r, heart[2] + z * r * 0.55]);
  }
  const points = writer(size(11_000));
  const lines = {
    pos: new Float32Array(starts.length * FLOW_STEPS * 6),
    col: new Float32Array(starts.length * FLOW_STEPS * 6),
    n: 0,
  };
  const segment = (a: Vec, b: Vec, ta: number, tb: number) => {
    const i = lines.n * 6;
    lines.pos.set([a[0], a[1], a[2], b[0], b[1], b[2]], i);
    mix.copy(FLOW_FAINT).lerp(FLOW_BRIGHT, ta);
    lines.col.set([mix.r, mix.g, mix.b], i);
    mix.copy(FLOW_FAINT).lerp(FLOW_BRIGHT, tb);
    lines.col.set([mix.r, mix.g, mix.b], i + 3);
    lines.n += 1;
  };
  for (const [k, start] of starts.entries()) {
    /* Virgo's spur bends through Centaurus; the rest bow by a random control point. */
    const control: Vec =
      k === 0
        ? centaurus
        : [
            (start[0] + heart[0]) / 2 + gauss() * 40,
            (start[1] + heart[1]) / 2 + gauss() * 40,
            (start[2] + heart[2]) / 2 + gauss() * 20,
          ];
    const groups = 10 + Math.floor(rnd() * 12);
    for (let g = 0; g < groups; g += 1) {
      /* Denser toward the attractor. */
      const t = Math.sqrt((g + rnd()) / groups);
      const at = bezier(start, control, heart, t);
      group(points, rnd, at, size(6 + Math.floor(rnd() * 22 * (0.5 + t))), 1.5 + rnd() * 2.5, 0.8);
    }
    let prev = bezier(start, control, heart, 0);
    for (let s = 1; s <= FLOW_STEPS; s += 1) {
      const t = s / FLOW_STEPS;
      /* Lines stop short of the heart, where they would only pile up. */
      const next = bezier(start, control, heart, t * 0.94);
      const a = fromSupergalactic(prev[0], prev[1], prev[2]);
      const b = fromSupergalactic(next[0], next[1], next[2]);
      segment(a, b, (s - 1) / FLOW_STEPS, t);
      prev = next;
    }
  }
  /* A sparse field filling the basin between the filaments. */
  for (let i = 0; i < size(1600); i += 1) {
    const [x, y, z] = onSphere(rnd, Math.cbrt(rnd()) * 260);
    const { color, brightness } = tint(rnd, 0.1);
    putSg(points, heart[0] + x, heart[1] + y, heart[2] + z * 0.55, color, brightness * 0.6);
  }
  const flows = new BufferGeometry();
  flows.setAttribute("position", new BufferAttribute(lines.pos.subarray(0, lines.n * 6), 3));
  flows.setAttribute("color", new BufferAttribute(lines.col.subarray(0, lines.n * 6), 3));
  return { points: geometryOf(points), flows };
}
