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
 *   with flow lines along them, as in the Cosmicflows map of peculiar velocities;
 * - the cosmic web: the Perseus–Pisces chain, the Shapley concentration and the Sloan Great
 *   Wall at their measured places, tied into a seeded web of filaments around empty voids.
 */
import { BufferAttribute, BufferGeometry, Color } from "three";

import type { Vec3 } from "@horizon/toolkit/bodies";
import { gaussian, lcg, onSphere, smoothstep } from "@horizon/toolkit/math";
import { createPointWriter, pointsGeometry, type PointWriter } from "@horizon/toolkit/scene";
import { convert } from "@horizon/toolkit/science";

import {
  PERSEUS_PISCES_CHAIN,
  SHAPLEY_CLUSTERS,
  SLOAN_WALL,
  SUPERGALACTIC,
  anchorById,
  anchorToday,
  fromSupergalactic,
  skyPlace,
  type AnchorId,
} from "../model/cosmos";

type Rnd = () => number;

const SPIRAL = new Color("#c9d6ff");
const ELLIPTICAL = new Color("#ffdcae");
const DWARF = new Color("#b9c2d6");
const mix = new Color();

/** A point in supergalactic coordinates (Mly) added to `w`, converted to model axes. */
function putSg(w: PointWriter, x: number, y: number, z: number, c: Color, brightness: number) {
  const v = fromSupergalactic(x, y, z);
  w.put(v[0], v[1], v[2], c, brightness);
}
const toSg = (v: Readonly<Vec3>): Vec3 => {
  const { x, y, z } = SUPERGALACTIC;
  return [
    v[0] * x[0] + v[1] * x[1] + v[2] * x[2],
    v[0] * y[0] + v[1] * y[1] + v[2] * y[2],
    v[0] * z[0] + v[1] * z[1] + v[2] * z[2],
  ];
};
const sgOf = (id: AnchorId) => toSg(anchorToday(anchorById(id)));

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
function group(w: PointWriter, rnd: Rnd, centre: Vec3, count: number, sigma: number, flat = 1) {
  const gauss = () => gaussian(rnd);
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

/** How densely the cosmic maps are sampled; a host's render quality gives one per level. */
export type CosmosDetail = {
  /** Share of each cloud's full count of galaxies. */
  share: number;
  /** Laniakea's filaments from its edge to the Great Attractor. */
  filaments: number;
  /** The seeded web's random knots. */
  knots: number;
  /** Galaxies per unit length along the measured chains and walls, and along the web's bridges. */
  strand: number;
  bridgeStrand: number;
};

const scaled = (detail: CosmosDetail) => (count: number) => Math.round(count * detail.share);

/**
 * The Local Group's dwarfs: those bound to the Milky Way (with the Magellanic Clouds) and the
 * loose ones, around the galactic centre; Andromeda's own, around Andromeda.
 */
export function localGroupClouds(detail: CosmosDetail) {
  const size = scaled(detail);
  const rnd = lcg(41);
  const local = createPointWriter(size(70));
  const andromeda = createPointWriter(size(50));
  const m31 = anchorToday(anchorById("andromeda"));
  const satellites = (w: PointWriter, count: number, reach: number, origin: Vec3) => {
    for (let i = 0; i < count; i += 1) {
      const r = 0.04 + ballRadius(rnd, 0.12, reach);
      const [x, y, z] = onSphere(rnd, r);
      w.put(origin[0] + x, origin[1] + y, origin[2] + z, DWARF, 0.55 + rnd() * 0.45);
    }
  };
  satellites(local, size(40), 0.9, [0, 0, 0]);
  satellites(andromeda, size(46), 1, [0, 0, 0]);
  /* The Magellanic Clouds, brighter than the rest. */
  for (const id of ["lmc", "smc"] as const) {
    const p = anchorToday(anchorById(id));
    local.put(p[0], p[1], p[2], SPIRAL, id === "lmc" ? 1.3 : 1);
  }
  /* Loose members out to the zero-velocity surface, ~1 Mpc from the mass centre. */
  const centre: Vec3 = [m31[0] * 0.55, m31[1] * 0.55, m31[2] * 0.55];
  for (let i = 0; i < size(24); i += 1) {
    const [x, y, z] = onSphere(rnd, 1.2 + rnd() * 2.8);
    local.put(centre[0] + x, centre[1] + y * 0.6, centre[2] + z, DWARF, 0.45 + rnd() * 0.35);
  }
  return { local: local.geometry(), andromeda: andromeda.geometry() };
}

/**
 * The Local Sheet: the nearby groups in a thin slab about the supergalactic equator, 7 Mpc
 * (~23 Mly) in radius and ±1.5 Mpc (~±5 Mly) thick (Tully et al. 2008).
 */
export function localSheet(detail: CosmosDetail) {
  const size = scaled(detail);
  const rnd = lcg(53);
  const w = createPointWriter(size(520));
  for (const id of ["m81", "centaurusA", "sculptor"] as const)
    group(w, rnd, sgOf(id), size(36), 0.9, 0.7);
  for (let k = 0; k < 22; k += 1) {
    const r = 5 + Math.sqrt(rnd()) * 17;
    const t = rnd() * Math.PI * 2;
    const centre: Vec3 = [Math.cos(t) * r, Math.sin(t) * r, gaussian(rnd) * 2];
    group(w, rnd, centre, size(4 + Math.floor(rnd() * 12)), 0.6 + rnd() * 0.7, 0.6);
  }
  const gauss = () => gaussian(rnd);
  for (let i = 0; i < size(90); i += 1) {
    const r = 3 + Math.sqrt(rnd()) * 20;
    const t = rnd() * Math.PI * 2;
    const { color, brightness } = tint(rnd, 0.1);
    putSg(w, Math.cos(t) * r, Math.sin(t) * r, gauss() * 2.2, color, brightness * 0.8);
  }
  return w.geometry();
}

/**
 * A rich cluster around its own centre (Mly): `core` sets the concentration, `reach` the
 * outer edge. Members are written in a fixed random order, so a draw range of the first n
 * shows a cluster still gathering.
 */
export function clusterCloud(count: number, core: number, reach: number, seed: number) {
  const rnd = lcg(seed);
  const w = createPointWriter(count);
  for (let i = 0; i < count; i += 1) {
    const r = ballRadius(rnd, core, reach);
    const [x, y, z] = onSphere(rnd, r);
    const { color, brightness } = tint(rnd, Math.max(0.15, 0.85 - r / reach));
    w.put(x, y, z, color, brightness);
  }
  return w.geometry();
}

/** The Virgo Supercluster: spurs and clouds fanning out from Virgo in the supergalactic plane. */
export function localSupercluster(detail: CosmosDetail) {
  const size = scaled(detail);
  const rnd = lcg(67);
  const w = createPointWriter(size(3200));
  const virgo = sgOf("virgoCluster");
  const gauss = () => gaussian(rnd);
  /* One spur runs from Virgo through the Local Group and on past it. */
  const spurs: { to: Vec3; groups: number }[] = [
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
      const centre: Vec3 = [
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
  return w.geometry();
}

/**
 * Galaxies far behind the nearby ones, as directions on a unit sphere: most in loose clumps,
 * the rest spread evenly. Not a map of anything; the layer draws it far around the camera
 * until the real web of Laniakea takes over.
 */
export function deepField(detail: CosmosDetail) {
  const size = scaled(detail);
  const rnd = lcg(97);
  const gauss = () => gaussian(rnd);
  const count = size(2400);
  const w = createPointWriter(count);
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
    w.put(x, y, z, color, brightness * 0.8);
  }
  return w.geometry();
}

/** A point on a quadratic Bézier from a to c through control b. */
function bezier(a: Readonly<Vec3>, b: Readonly<Vec3>, c: Readonly<Vec3>, t: number): Vec3 {
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
export function laniakeaWeb(detail: CosmosDetail) {
  const size = scaled(detail);
  const rnd = lcg(79);
  const gauss = () => gaussian(rnd);
  const heart = sgOf("greatAttractor");
  const virgo = sgOf("virgoCluster");
  const centaurus = sgOf("centaurusCluster");
  const hydra = sgOf("hydraCluster");
  const starts: Vec3[] = [virgo, hydra];
  for (let k = 0; k < detail.filaments; k += 1) {
    const [x, y, z] = onSphere(rnd, 1);
    const r = 150 + rnd() * 120;
    /* Flatter than round, like the basin. */
    starts.push([heart[0] + x * r, heart[1] + y * r, heart[2] + z * r * 0.55]);
  }
  const points = createPointWriter(size(14_000));
  const lines = {
    pos: new Float32Array(starts.length * FLOW_STEPS * 6),
    col: new Float32Array(starts.length * FLOW_STEPS * 6),
    n: 0,
  };
  const segment = (a: Vec3, b: Vec3, ta: number, tb: number) => {
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
    const control: Vec3 =
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
  const flows = pointsGeometry(
    lines.pos.subarray(0, lines.n * 6),
    lines.col.subarray(0, lines.n * 6),
  );
  return { points: points.geometry(), flows };
}

/** Galaxies strung from a to b along a gentle bow: groups every `step` Mly, where `keep` allows. */
function filament(
  w: PointWriter,
  rnd: Rnd,
  a: Readonly<Vec3>,
  b: Readonly<Vec3>,
  step: number,
  sigma: number,
  scale = 1,
  keep: (at: Readonly<Vec3>) => boolean = () => true,
) {
  const gauss = () => gaussian(rnd);
  const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const bow = length * 0.12;
  const control: Vec3 = [
    (a[0] + b[0]) / 2 + gauss() * bow,
    (a[1] + b[1]) / 2 + gauss() * bow,
    (a[2] + b[2]) / 2 + gauss() * bow,
  ];
  const groups = Math.max(2, Math.round(length / step));
  for (let g = 0; g < groups; g += 1) {
    const at = bezier(a, control, b, (g + rnd()) / groups);
    const count = Math.round((3 + rnd() * 9) * scale);
    if (!keep(at)) continue;
    for (let i = 0; i < count; i += 1) {
      const { color, brightness } = tint(rnd, 0.2);
      w.put(
        at[0] + gauss() * sigma,
        at[1] + gauss() * sigma,
        at[2] + gauss() * sigma,
        color,
        brightness * 0.7,
      );
    }
  }
}

/** A knot where filaments meet: a loose ball of galaxies. */
function knot(
  w: PointWriter,
  rnd: Rnd,
  at: Readonly<Vec3>,
  count: number,
  core: number,
  reach: number,
) {
  for (let i = 0; i < count; i += 1) {
    const [x, y, z] = onSphere(rnd, ballRadius(rnd, core, reach));
    const { color, brightness } = tint(rnd, 0.5);
    w.put(at[0] + x, at[1] + y, at[2] + z, color, brightness * 0.8);
  }
}

/** Radius of the seeded web around the Milky Way, Mly: past the Sloan Great Wall. */
const WEB_RADIUS_MLY = 1_700;
/** Laniakea's basin, drawn on its own (`laniakeaWeb`): the seeded web leaves it out. */
const BASIN_MLY = 280;

/**
 * The cosmic web beyond Laniakea, in Mly (model axes): the Perseus–Pisces chain across the
 * Local Void, the clusters of the Shapley concentration and the Sloan Great Wall where they
 * are measured, and a seeded web of knots joined to their nearest neighbours, so voids open
 * between filaments. Laniakea's own basin is left to `laniakeaWeb`.
 */
export function cosmicWeb(detail: CosmosDetail) {
  const size = scaled(detail);
  const rnd = lcg(131);
  const w = createPointWriter(size(21_000));
  const heart = anchorToday(anchorById("greatAttractor"));
  const dist = (a: Readonly<Vec3>, b: Readonly<Vec3>) =>
    Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  /* Perseus–Pisces: groups strung along the measured chain. */
  const chain = PERSEUS_PISCES_CHAIN.map((p) => skyPlace(p.ra, p.dec, p.cz));
  for (let i = 1; i < chain.length; i += 1)
    filament(w, rnd, chain[i - 1]!, chain[i]!, 4, 2.2, detail.strand);
  /* Shapley: its rich clusters, each a dense knot. */
  const shapley = SHAPLEY_CLUSTERS.map((p) => skyPlace(p.ra, p.dec, p.cz));
  for (const at of shapley) knot(w, rnd, at, size(120), 2, 12);
  /* The Sloan Great Wall: groups along the measured arc, a few knots in it. */
  /* Bent in depth about its redshift; the middle waypoint is the labelled one, so it stays put. */
  const wall: Vec3[] = [];
  const { ra, dec, z, swing } = SLOAN_WALL;
  const cz = z * convert(1, "c", "km/s");
  for (let k = 0; k <= 12; k += 1) {
    const t = k / 12;
    const jitter = k === 6 ? 0 : 1;
    wall.push(
      skyPlace(
        ra[0] + (ra[1] - ra[0]) * t,
        dec + (rnd() - 0.5) * 3 * jitter,
        cz + swing * Math.sin(t * Math.PI * 2) + (rnd() - 0.5) * 900 * jitter,
      ),
    );
  }
  for (let i = 1; i < wall.length; i += 1)
    filament(w, rnd, wall[i - 1]!, wall[i]!, 6, 6, detail.strand);
  for (let i = 1; i < wall.length; i += 3) knot(w, rnd, wall[i]!, size(90), 3, 14);

  /* The seeded web: the landmarks and random knots, each joined to its nearest three. */
  const nodes: Readonly<Vec3>[] = [chain[0]!, chain[chain.length - 1]!, ...shapley.slice(0, 2)];
  nodes.push(wall[0]!, wall[wall.length - 1]!);
  const coma = anchorToday(anchorById("comaCluster"));
  nodes.push(coma);
  for (let k = 0; k < detail.knots; k += 1) {
    const p = onSphere(rnd, Math.cbrt(rnd()) * WEB_RADIUS_MLY);
    if (dist(p, heart) < BASIN_MLY) continue;
    nodes.push(p);
    knot(w, rnd, p, size(8 + Math.floor(rnd() * 24)), 3, 16);
  }
  /* Nothing of the seeded web inside Laniakea's basin: no chord through it, no group in it. */
  const outside = (p: Readonly<Vec3>) => dist(p, heart) >= BASIN_MLY;
  const missesBasin = (a: Readonly<Vec3>, b: Readonly<Vec3>) => {
    const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const t = Math.min(
      1,
      Math.max(
        0,
        ((heart[0] - a[0]) * ab[0] + (heart[1] - a[1]) * ab[1] + (heart[2] - a[2]) * ab[2]) /
          (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1),
      ),
    );
    return outside([a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]);
  };
  const joined = new Set<string>();
  for (const [i, a] of nodes.entries()) {
    const nearest = nodes
      .map((b, j) => ({ j, d: dist(a, b) }))
      .filter(({ j }) => j !== i)
      .sort((x, y) => x.d - y.d)
      .slice(0, 3);
    for (const { j, d } of nearest) {
      const pair = i < j ? `${i}:${j}` : `${j}:${i}`;
      if (joined.has(pair) || d > 650 || !missesBasin(a, nodes[j]!)) continue;
      joined.add(pair);
      filament(w, rnd, a, nodes[j]!, 30, 5, detail.bridgeStrand, outside);
    }
  }
  return w.geometry();
}

/** Illustrative distant galaxies and unit lookback rings. The CMB is loaded separately from data. */
export function observableUniverse(detail: CosmosDetail) {
  const size = scaled(detail);
  const rnd = lcg(173);
  const fill = createPointWriter(size(18_000));
  for (let i = 0; i < size(18_000); i += 1) {
    const r = Math.cbrt(rnd());
    const [x, y, z] = onSphere(rnd, r);
    const { color, brightness } = tint(rnd, 0.2);
    /* Fewer and fainter toward the first galaxies, as the first ones were. */
    fill.put(x, y, z, color, brightness * (1 - 0.85 * smoothstep(0.7, 1, r)));
  }
  const ring = new Float32Array(128 * 3);
  for (let i = 0; i < 128; i += 1) {
    const angle = (i / 128) * Math.PI * 2;
    ring[i * 3] = Math.cos(angle);
    ring[i * 3 + 1] = Math.sin(angle);
  }
  const circle = new BufferGeometry();
  circle.setAttribute("position", new BufferAttribute(ring, 3));
  return { fill: fill.geometry(), circle };
}
