/**
 * A star's weather, without WebGL: where its active regions are, when they flare, the
 * prominences over them (or a supergiant's plumes and dust), the loops a flare leaves and the
 * ejections that leave with it. Everything follows from the star's seed and the time, so a
 * moment can be shown again exactly: a region lives and dies in its own slot; a flare comes
 * once in each window, at a dice-thrown moment, rises fast and fades slowly; every few, a big
 * one near the limb lifts its prominence away as an ejection. Paces are display paces, and
 * which stars do what is a teaching choice that follows what is observed.
 *
 * Positions on the surface are in the body's frame (y its pole, the shader's `s`); what is
 * drawn beyond the limb is in the view's (x right, y up, z towards us), in equatorial radii.
 *
 * It runs every frame, so a forecast (`createForecast`) writes into the same slots each time,
 * and each flare window's outbreak (its region, peak and eruption) is rolled once and kept.
 */
import {
  TAU,
  add3,
  cross3,
  normalize3,
  scale3,
  smoothstep,
  wrapSigned,
  type Vec3,
} from "@horizon/toolkit/math";

import {
  BIG_FLARE_EVERY,
  DIFFERENTIAL_ROTATION,
  ARCADES,
  EJECTIONS,
  EJECTION_ACCELERATION,
  EJECTION_REACH,
  EJECTION_SPEED,
  ERUPTING_FLARE,
  ERUPTION_SECONDS,
  FLARE_DECAY_S,
  FLARE_LIFE_SHARE,
  FLARE_RISE_S,
  JOY_TILT,
  LIMB_ERUPTION,
  LOOPS,
  LOOPS_PER_ARCADE,
  LOOP_DELAY_S,
  LOOP_POINTS,
  PROMINENCE_REGROW_S,
  REGIONS,
  REGION_SECONDS,
  SHEETS,
  SHEET_POINTS,
} from "../parameters";

/**
 * What a star does: a Sun-like star's spots, flares, prominences and ejections; a red dwarf's
 * bigger spots and fiercer flares; a red giant's few quiet spots; a red supergiant's plumes
 * and the dust veils they leave; nothing.
 */
export type ActivityKind = "solar" | "flare" | "quiet" | "plumes" | "none";

type Profile = {
  /** Active regions at once, their spot groups' size (radians) and their latitude band. */
  regions: number;
  size: number;
  latitudes: readonly [number, number];
  /** Seconds between flares (0: none) and a big one's light against the face. */
  flareEvery: number;
  flarePeak: number;
  /** Prominences (or plumes) at once and their height, radii. */
  sheets: number;
  height: number;
  /** Big flares near the limb launch ejections. */
  ejections: boolean;
  /** The corona's and the chromosphere's brightness, 0–1. */
  corona: number;
  chromosphere: number;
};

const NONE: Profile = {
  regions: 0,
  size: 0,
  latitudes: [0, 0],
  flareEvery: 0,
  flarePeak: 0,
  sheets: 0,
  height: 0,
  ejections: false,
  corona: 0,
  chromosphere: 0,
};

/**
 * Teaching choices by kind. The Sun keeps its spots within about 35° of its equator; red
 * dwarfs are spotted to high latitudes and flare often and brightly against their dim faces;
 * red giants past the dividing line keep a chromosphere but no hot corona (Linsky & Haisch
 * 1979); red supergiants lift plumes of gas that cool into dust (Montargès et al. 2021).
 */
export const ACTIVITY: Readonly<Record<ActivityKind, Profile>> = {
  solar: {
    regions: 4,
    size: 0.11,
    latitudes: [0.12, 0.6],
    flareEvery: 24,
    flarePeak: 1,
    sheets: 3,
    height: 0.13,
    ejections: true,
    corona: 1,
    chromosphere: 1,
  },
  flare: {
    regions: 4,
    size: 0.2,
    latitudes: [0.25, 1.25],
    flareEvery: 13,
    flarePeak: 2.4,
    sheets: 2,
    height: 0.16,
    ejections: true,
    corona: 0.8,
    chromosphere: 1,
  },
  quiet: { ...NONE, regions: 1, size: 0.1, latitudes: [0.1, 0.7], chromosphere: 0.55 },
  plumes: { ...NONE, regions: 1, size: 0.55, latitudes: [0, 1.2], sheets: 2, height: 0.55 },
  none: NONE,
};

/**
 * What the shader draws of a star's weather at one moment, in the fixed slots it reads: a slot
 * not in use is dark (its strength or brightness 0).
 */
export type Region = {
  centre: Vec3;
  /** The group's angular radius, radians. */
  size: number;
  /** How far grown it is: 0 at birth and death, 1 in its prime. */
  strength: number;
  /** The tilt of the leader–follower axis towards the equator (Joy's law), radians. */
  tilt: number;
  /** Light of a flare in it now, against the face. */
  flare: number;
  /** A supergiant's dust veil rather than a spot group. */
  veil: boolean;
  /** Where it is in the view: a corona's streamer stands over it at the limb. */
  view: Vec3;
};
/** A column of a sheet: its underside and top, radii, and its top's depth in front of the sky's plane. */
export type Column = { inner: number; outer: number; depth: number };
/**
 * A prominence or a plume beyond the limb, as columns at even position angles from `start`
 * (radians from the view's x axis, anticlockwise) `step` apart.
 */
export type Sheet = {
  start: number;
  step: number;
  brightness: number;
  /** 0: glowing in the Balmer lines (pink); 1: in the star's own cooler light. */
  own: number;
  /** How much of an arch is hollow beneath its top (0: a hedgerow standing on the surface). */
  hollow: number;
  columns: Column[];
};
export type Loop = { points: Vec3[]; width: number; brightness: number };
export type Ejection = { angle: number; front: number; spread: number; brightness: number };
/** A flare lit now: where it is in the view and its light. */
export type Flash = { at: Vec3; strength: number };
export type Weather = {
  regions: Region[];
  sheets: Sheet[];
  loops: Loop[];
  ejections: Ejection[];
  /** The flares lit now, at most `ARCADES`. */
  flashes: Flash[];
  corona: number;
  chromosphere: number;
};

/**
 * The globe a weather sits on: its seed, display spin and the pole's tilt towards us, and any
 * turn a hand has given it on top of its spin (`grab.ts`), radians.
 */
export type Globe = { seed: number; spin: number; tilt: number; twist?: number };

const vec3 = (): Vec3 => [0, 0, 0];
const slots = <T>(count: number, make: () => T) => Array.from({ length: count }, make);
const POLE: Readonly<Vec3> = [0, 1, 0];

/** One round of murmur3's mix. */
function mix(h: number, value: number) {
  h = Math.imul(h ^ Math.floor(value), 0xcc9e2d51);
  h = (h << 15) | (h >>> 17);
  return Math.imul(h, 0x1b873593) ^ 0xe6546b64;
}

/** A repeatable number in [0, 1) for a seed and one to three integers: the schedule's dice (murmur3's mix). */
function dice(seed: number, a: number, b?: number, c?: number) {
  let h = mix(Math.floor(seed * 2 ** 31) | 0, a);
  if (b !== undefined) h = mix(h, b);
  if (c !== undefined) h = mix(h, c);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 2 ** 32;
}

/**
 * The globe's turn at a time, radians: the shader turns its surface by the same angle. It
 * falls with time, so the surface moves from left to right, east to west, as the Sun's and
 * the Earth's do seen with north up.
 */
export function turnAt(globe: Globe, time: number) {
  const own = globe.spin > 0 ? TAU * (globe.seed - time / globe.spin) : TAU * globe.seed;
  return own + (globe.twist ?? 0);
}

/**
 * A point of the body's frame as the view sees it: turned back by the spin, then its pole
 * tipped `tilt` towards us (the shader's `hitSpheroid` and `turned`, inverted).
 */
export function toView(
  point: Readonly<Vec3>,
  turn: number,
  tilt: number,
  out: Vec3 = vec3(),
): Vec3 {
  const [x, y, z] = point;
  const c = Math.cos(-turn);
  const s = Math.sin(-turn);
  const ux = c * x + s * z;
  const uz = -s * x + c * z;
  const ct = Math.cos(tilt);
  const st = -Math.sin(tilt);
  out[0] = ux;
  out[1] = ct * y + st * uz;
  out[2] = -st * y + ct * uz;
  return out;
}

/** A flare's light at an age before it is scaled to peak 1. */
const flareShape = (age: number) =>
  (1 - Math.exp(-age / FLARE_RISE_S)) * Math.exp(-age / FLARE_DECAY_S);
const FLARE_PEAK = flareShape(FLARE_RISE_S * Math.log(1 + FLARE_DECAY_S / FLARE_RISE_S));

/** A flare's light at an age, its peak 1: a fast rise and a slow decay. */
export function flareLight(age: number) {
  return age <= 0 ? 0 : flareShape(age) / FLARE_PEAK;
}

type Site = {
  /** Which life of its slot this is: a new one is born elsewhere. */
  epoch: number;
  centre: Vec3;
  latitude: number;
  size: number;
  strength: number;
  tilt: number;
};

const blankSite = (): Site => ({
  epoch: 0,
  centre: vec3(),
  latitude: 0,
  size: 0,
  strength: 0,
  tilt: 0,
});

function copySite(from: Site, to: Site) {
  to.epoch = from.epoch;
  to.centre[0] = from.centre[0];
  to.centre[1] = from.centre[1];
  to.centre[2] = from.centre[2];
  to.latitude = from.latitude;
  to.size = from.size;
  to.strength = from.strength;
  to.tilt = from.tilt;
}

/**
 * A slot's site at a time, written into `out`: born at a dice-thrown latitude and longitude, it
 * grows quickly, lives and fades, then is born again elsewhere. It drifts with the latitude's
 * own spin (slower towards the poles), so a long-lived site falls behind the equator's.
 */
function siteAt(
  globe: Globe,
  slot: number,
  time: number,
  life: number,
  band: readonly [number, number],
  size: number,
  out: Site,
): Site {
  const span = life * (0.75 + 0.5 * dice(globe.seed, slot, 1));
  const clock = time / span + dice(globe.seed, slot, 2);
  const epoch = Math.floor(clock);
  const age = clock - epoch;
  const north = dice(globe.seed, slot, epoch, 3) < 0.5 ? -1 : 1;
  const latitude = north * (band[0] + (band[1] - band[0]) * dice(globe.seed, slot, epoch, 4));
  const spinRate = globe.spin > 0 ? TAU / globe.spin : 0;
  const lag = spinRate * DIFFERENTIAL_ROTATION * Math.sin(latitude) ** 2 * age * span;
  const longitude = TAU * dice(globe.seed, slot, epoch, 5) - lag;
  out.epoch = epoch;
  out.centre[0] = Math.cos(latitude) * Math.sin(longitude);
  out.centre[1] = Math.sin(latitude);
  out.centre[2] = Math.cos(latitude) * Math.cos(longitude);
  out.latitude = latitude;
  out.size = size * (0.6 + 0.8 * dice(globe.seed, slot, epoch, 6));
  out.strength = smoothstep(0, 0.12, age) * (1 - smoothstep(0.72, 1, age));
  out.tilt = JOY_TILT * Math.abs(latitude);
  return out;
}

/** Scratch for a group's axes: east, north, the leader–follower axis and the neutral line. */
const east = vec3();
const north = vec3();
const axis = vec3();
const line = vec3();

/** The leader–follower axis of a group and the neutral line between them, both tangent (into `axis` and `line`). */
function axesOf(site: Site) {
  normalize3(cross3(POLE, site.centre, east), east);
  cross3(site.centre, east, north);
  /* The leader sits towards the equator: in the north it tips south, in the south north. */
  const lean = site.latitude >= 0 ? -1 : 1;
  scale3(east, Math.cos(site.tilt), axis);
  normalize3(add3(axis, scale3(north, lean * Math.sin(site.tilt), north), axis), axis);
  cross3(site.centre, axis, line);
}

/** How many flare windows back a profile's flares can still show: their loops and the prominence's regrowth. */
const windowsBack = (profile: Profile) =>
  profile.flareEvery
    ? Math.ceil(Math.max(FLARE_DECAY_S * 7, PROMINENCE_REGROW_S) / profile.flareEvery) + 1
    : 0;
/** Flare windows that can show at once, for any profile: the outbreaks a forecast keeps. */
const WINDOWS = Math.max(...Object.values(ACTIVITY).map(windowsBack)) + 1;

/**
 * A window's outbreak, the same whenever it is asked for: its moment, the region's slot and the
 * site it broke out on (none when no region was alive then), its peak, whether it lifted its
 * prominence away, and the position angle and spread of the ejection it launched.
 */
type Outbreak = {
  globe: Globe | null;
  profile: Profile | null;
  window: number;
  start: number;
  slot: number;
  site: Site;
  peak: number;
  erupted: boolean;
  angle: number;
  spread: number;
};

/** A flare lit now: its outbreak, its age, its light and how much of what it shows is still lit (0–1). */
type Flare = { outbreak: Outbreak; age: number; light: number; lit: number };

/**
 * A prominence's (or a plume's) shape on the surface: along a site's neutral line, `half`
 * radians each way, an arch of `height` radii lifted `hollow` beneath its top.
 */
type Arch = {
  centre: Readonly<Vec3>;
  line: Readonly<Vec3>;
  half: number;
  height: number;
  phase: number;
  hollow: number;
};

/** Points along a prominence's spine before it is laid out as columns. */
const SPINE = 2 * SHEET_POINTS + 1;

/**
 * A forecaster: `at` writes a star's weather at a time, for a globe turned and tipped as the
 * shader draws it, into the same slots on every call.
 */
export function createForecast() {
  const weather: Weather = {
    regions: slots(REGIONS, () => ({
      centre: vec3(),
      size: 0,
      strength: 0,
      tilt: 0,
      flare: 0,
      veil: false,
      view: vec3(),
    })),
    sheets: slots(SHEETS, () => ({
      start: 0,
      step: 0,
      brightness: 0,
      own: 0,
      hollow: 0,
      columns: slots(SHEET_POINTS, () => ({ inner: 1, outer: 0, depth: 0 })),
    })),
    loops: slots(LOOPS, () => ({
      points: slots(LOOP_POINTS, vec3),
      width: 0,
      brightness: 0,
    })),
    ejections: slots(EJECTIONS, () => ({ angle: 0, front: 0, spread: 0, brightness: 0 })),
    flashes: slots(ARCADES, () => ({ at: vec3(), strength: 0 })),
    corona: 0,
    chromosphere: 0,
  };
  const sites = slots(REGIONS, blankSite);
  const candidates = slots(REGIONS, blankSite);
  const plumeSite = blankSite();
  const outbreaks: Outbreak[] = slots(WINDOWS, () => ({
    globe: null,
    profile: null,
    window: -1,
    start: 0,
    slot: -1,
    site: blankSite(),
    peak: 0,
    erupted: false,
    angle: 0,
    spread: 0,
  }));
  const flares: Flare[] = slots(WINDOWS, () => ({
    outbreak: outbreaks[0]!,
    age: 0,
    light: 0,
    lit: 0,
  }));
  /** Each region slot's youngest eruption, s (Infinity: none). */
  const erupting = new Float64Array(REGIONS);
  /** The spine's points, unwrapped round the limb. */
  const spine = {
    angle: new Float64Array(SPINE),
    inner: new Float64Array(SPINE),
    outer: new Float64Array(SPINE),
    depth: new Float64Array(SPINE),
  };
  const foot = vec3();
  const lifted = vec3();
  const seen = vec3();
  const ends = [vec3(), vec3()] as const;

  /**
   * A window's outbreak (`Outbreak`), rolled once and kept: on a region alive then, most on a
   * dice-thrown one; every `BIG_FLARE_EVERY`th is big, on the living region nearest the limb,
   * so its eruption is seen side-on (a teaching choice). It keeps the site it broke out on, so
   * its loops and its ejection run their course as that region fades.
   */
  function outbreakOf(globe: Globe, profile: Profile, window: number): Outbreak {
    const outbreak = outbreaks[window % WINDOWS]!;
    if (outbreak.globe === globe && outbreak.profile === profile && outbreak.window === window)
      return outbreak;
    outbreak.globe = globe;
    outbreak.profile = profile;
    outbreak.window = window;
    const every = profile.flareEvery;
    const start = (window + 0.15 + 0.7 * dice(globe.seed, 101, window)) * every;
    outbreak.start = start;
    outbreak.slot = -1;
    const turn = turnAt(globe, start);
    const big = window % BIG_FLARE_EVERY === BIG_FLARE_EVERY - 1;
    let alive = 0;
    let chosen = -1;
    let limbward = Infinity;
    for (let slot = 0; slot < Math.min(profile.regions, REGIONS); slot++) {
      const site = siteAt(
        globe,
        slot,
        start,
        REGION_SECONDS,
        profile.latitudes,
        profile.size,
        candidates[slot]!,
      );
      if (site.strength < 0.25) continue;
      if (big) {
        const depth = Math.abs(toView(site.centre, turn, globe.tilt, seen)[2]);
        if (depth < limbward) [limbward, chosen] = [depth, slot];
      }
      alive++;
    }
    if (!alive) return outbreak;
    if (!big) {
      /* The dice pick among the living regions, in slot order. */
      let pick = Math.floor(dice(globe.seed, 103, window) * alive);
      for (let slot = 0; chosen < 0; slot++)
        if (candidates[slot]!.strength >= 0.25 && pick-- === 0) chosen = slot;
    }
    const site = candidates[chosen]!;
    copySite(site, outbreak.site);
    outbreak.slot = chosen;
    const roll = dice(globe.seed, 102, window);
    outbreak.peak = profile.flarePeak * (big ? 0.75 + 0.25 * roll : 0.15 + 0.4 * roll * roll);
    const launch = toView(site.centre, turn, globe.tilt, seen);
    outbreak.erupted =
      profile.ejections &&
      outbreak.peak >= ERUPTING_FLARE * profile.flarePeak &&
      Math.abs(launch[2]) <= LIMB_ERUPTION;
    outbreak.angle = Math.atan2(launch[1], launch[0]);
    outbreak.spread = 0.3 + 0.25 * dice(globe.seed, 104, start);
    return outbreak;
  }

  /** The flares lit now, one per window of the profile's pace, oldest first; returns how many. */
  function flaresAt(globe: Globe, profile: Profile, time: number) {
    if (!profile.flareEvery || !profile.regions) return 0;
    const every = profile.flareEvery;
    const now = Math.floor(time / every);
    const life = FLARE_LIFE_SHARE * every;
    let count = 0;
    for (let window = Math.max(0, now - windowsBack(profile)); window <= now; window++) {
      const outbreak = outbreakOf(globe, profile, window);
      const age = time - outbreak.start;
      if (age <= 0 || outbreak.slot < 0) continue;
      const flare = flares[count++]!;
      flare.outbreak = outbreak;
      flare.age = age;
      flare.light = flareLight(age) * outbreak.peak;
      flare.lit = 1 - smoothstep(0.5 * life, life, age);
    }
    return count;
  }

  /**
   * A prominence (or a plume) as the view sees it, written into `sheet`: its spine projected
   * and laid out as columns at even position angles, the outermost wherever two parts overlap.
   */
  function layOut(arch: Arch, turn: number, tilt: number, sheet: Sheet) {
    const { centre, half, height, phase, hollow } = arch;
    for (let i = 0; i < SPINE; i++) {
      const u = (i / (SPINE - 1)) * 2 - 1;
      scale3(centre, Math.cos(half * u), foot);
      add3(foot, scale3(arch.line, Math.sin(half * u), lifted), foot);
      /* Arched, a little lopsided and alive; an arch is hollow beneath its top. */
      const lift = height * (1 - u * u) ** 0.6 * (1 + 0.25 * Math.sin(3 * u + phase));
      const top = toView(scale3(foot, 1 + lift, lifted), turn, tilt, lifted);
      const angle = Math.atan2(top[1], top[0]);
      /* Unwrapped round the limb from the first point. */
      spine.angle[i] =
        i === 0 ? angle : spine.angle[i - 1]! + wrapSigned(angle - spine.angle[i - 1]!, TAU);
      spine.outer[i] = Math.hypot(top[0], top[1]);
      spine.depth[i] = top[2];
      const base = toView(scale3(foot, 1 + hollow * lift * (1 - u * u), seen), turn, tilt, seen);
      spine.inner[i] = Math.hypot(base[0], base[1]);
    }
    let low = Infinity;
    let high = -Infinity;
    for (let i = 0; i < SPINE; i++) {
      low = Math.min(low, spine.angle[i]!);
      high = Math.max(high, spine.angle[i]!);
    }
    const step = (high - low) / (SHEET_POINTS - 1);
    sheet.columns.forEach((column, c) => {
      const angle = low + c * step;
      column.inner = 1;
      column.outer = 0;
      column.depth = 0;
      for (let i = 0; i + 1 < SPINE; i++) {
        const a = spine.angle[i]!;
        const b = spine.angle[i + 1]!;
        if (angle < Math.min(a, b) - 1e-9 || angle > Math.max(a, b) + 1e-9) continue;
        const t = Math.abs(b - a) > 1e-9 ? (angle - a) / (b - a) : 0;
        const outer = spine.outer[i]! + (spine.outer[i + 1]! - spine.outer[i]!) * t;
        if (outer <= column.outer) continue;
        column.inner = spine.inner[i]! + (spine.inner[i + 1]! - spine.inner[i]!) * t;
        column.outer = outer;
        column.depth = spine.depth[i]! + (spine.depth[i + 1]! - spine.depth[i]!) * t;
      }
    });
    sheet.start = wrapSigned(low, TAU);
    sheet.step = step;
  }

  /** A post-flare loop over a region, written into `loop`: an arch between footpoints either side of its neutral line. */
  function loopOver(
    site: Site,
    along: number,
    height: number,
    turn: number,
    tilt: number,
    loop: Loop,
  ) {
    axesOf(site);
    const middle = add3(site.centre, scale3(line, along * site.size, foot), foot);
    const [a, b] = ends;
    normalize3(add3(middle, scale3(axis, 0.28 * site.size, a), a), a);
    normalize3(add3(middle, scale3(axis, -0.28 * site.size, b), b), b);
    loop.points.forEach((point, i) => {
      const u = i / (LOOP_POINTS - 1);
      add3(scale3(a, 1 - u, point), scale3(b, u, seen), point);
      normalize3(point, point);
      toView(scale3(point, 1 + height * Math.sin(Math.PI * u), point), turn, tilt, point);
    });
  }

  function at(kind: ActivityKind, globe: Globe, time: number): Weather {
    const profile = ACTIVITY[kind];
    const plumes = kind === "plumes";
    const turn = turnAt(globe, time);
    const regions = Math.min(profile.regions, REGIONS);
    const count = flaresAt(globe, profile, time);
    /* A flare's ribbons light its region while that region lives. */
    const on = (flare: Flare, slot: number) =>
      flare.outbreak.slot === slot && flare.outbreak.site.epoch === sites[slot]!.epoch;

    weather.regions.forEach((region, slot) => {
      if (slot >= regions) return void (region.strength = 0);
      const site = siteAt(
        globe,
        slot,
        time,
        REGION_SECONDS,
        profile.latitudes,
        profile.size,
        sites[slot]!,
      );
      region.centre[0] = site.centre[0];
      region.centre[1] = site.centre[1];
      region.centre[2] = site.centre[2];
      region.size = site.size;
      region.strength = site.strength;
      region.tilt = site.tilt * (site.latitude >= 0 ? -1 : 1);
      region.veil = plumes;
      toView(site.centre, turn, globe.tilt, region.view);
      region.flare = 0;
      for (let k = 0; k < count; k++) {
        const flare = flares[k]!;
        if (on(flare, slot)) region.flare += flare.light * flare.lit;
      }
    });

    /* The prominence over an erupting region lifts away with it, then slowly re-forms. */
    erupting.fill(Infinity);
    let ejections = 0;
    for (let k = 0; k < count; k++) {
      const flare = flares[k]!;
      const { outbreak, age } = flare;
      if (!outbreak.erupted) continue;
      if (on(flare, outbreak.slot))
        erupting[outbreak.slot] = Math.min(age, erupting[outbreak.slot]!);
      /* Its ejection, while it is still in flight. */
      const front = 1 + EJECTION_SPEED * age + 0.5 * EJECTION_ACCELERATION * age * age;
      if (front > EJECTION_REACH || ejections >= EJECTIONS) continue;
      const ejection = weather.ejections[ejections++]!;
      ejection.angle = outbreak.angle;
      ejection.front = front;
      ejection.spread = outbreak.spread;
      ejection.brightness =
        smoothstep(0, 1.2, age) * (1 - smoothstep(0.55 * EJECTION_REACH, EJECTION_REACH, front));
    }
    for (let k = ejections; k < EJECTIONS; k++) weather.ejections[k]!.brightness = 0;

    weather.sheets.forEach((sheet, slot) => {
      if (slot >= Math.min(profile.sheets, SHEETS)) return void (sheet.brightness = 0);
      /* Prominences stand over the active regions, past those quiet ones near the poles; a
         supergiant's plumes rise anywhere, living a little longer. */
      const site =
        !plumes && slot < regions
          ? sites[slot]!
          : plumes
            ? siteAt(
                globe,
                50 + slot,
                time,
                REGION_SECONDS * 1.4,
                profile.latitudes,
                profile.size,
                plumeSite,
              )
            : siteAt(globe, 50 + slot, time, REGION_SECONDS * 1.4, [0.7, 1.15], 0.3, plumeSite);
      const since = slot < REGIONS ? erupting[slot]! : Infinity;
      const gone = ERUPTION_SECONDS * 2.5;
      const regrown =
        since === Infinity ? 1 : smoothstep(0.6 * PROMINENCE_REGROW_S, PROMINENCE_REGROW_S, since);
      /* Gone by `gone` seconds, it starts again low: the switch is unseen. */
      const rising =
        since === Infinity ? 1 : since < gone ? Math.exp(since / ERUPTION_SECONDS) : regrown;
      const fading = since === Infinity ? 1 : 1 - smoothstep(0, gone, since) + regrown;
      const breathing = 1 + 0.12 * Math.sin(time * 0.21 + TAU * dice(globe.seed, 60, slot));
      const height = profile.height * (0.6 + 0.6 * dice(globe.seed, 61, slot)) * breathing;
      const hollow = plumes ? 0 : 0.7 * dice(globe.seed, 63, slot, site.epoch);
      axesOf(site);
      layOut(
        {
          centre: site.centre,
          line,
          half: site.size * (plumes ? 0.9 : 1.4),
          height: height * Math.sqrt(site.strength) * rising,
          phase: TAU * dice(globe.seed, 62, slot),
          hollow,
        },
        turn,
        globe.tilt,
        sheet,
      );
      sheet.brightness = site.strength * fading * (sheet.step > 1e-5 ? 1 : 0);
      sheet.own = plumes ? 1 : 0;
      sheet.hollow = hollow;
    });

    /* Each flare still lit has its glare and leaves an arcade of loops; at most `ARCADES` are,
       the latest. */
    let lit = 0;
    for (let k = 0; k < count; k++) if (flares[k]!.lit > 0) lit++;
    let arcade = 0;
    for (let k = 0, skip = lit - ARCADES; k < count; k++) {
      const flare = flares[k]!;
      if (flare.lit <= 0 || skip-- > 0) continue;
      const { site, peak } = flare.outbreak;
      const flash = weather.flashes[arcade]!;
      toView(site.centre, turn, globe.tilt, flash.at);
      flash.strength = flare.light * flare.lit;
      const after = flareLight(flare.age - LOOP_DELAY_S) * peak * flare.lit;
      /* The loops rise as the flare's reconnection works higher. */
      const growth = 1 - Math.exp(-flare.age / (FLARE_DECAY_S * 1.5));
      for (let j = 0; j < LOOPS_PER_ARCADE; j++) {
        const loop = weather.loops[arcade * LOOPS_PER_ARCADE + j]!;
        const along = (j / Math.max(1, LOOPS_PER_ARCADE - 1) - 0.5) * 0.8;
        const height = site.size * (0.3 + 0.4 * growth) * (0.8 + 0.4 * dice(globe.seed, 70, j));
        loopOver(site, along, height, turn, globe.tilt, loop);
        loop.width = site.size * 0.13;
        loop.brightness = after;
      }
      arcade++;
    }
    for (let k = arcade; k < ARCADES; k++) weather.flashes[k]!.strength = 0;
    for (let k = arcade * LOOPS_PER_ARCADE; k < LOOPS; k++) weather.loops[k]!.brightness = 0;

    weather.corona = profile.corona;
    weather.chromosphere = profile.chromosphere;
    return weather;
  }

  return { at };
}

/** A star's weather at a time, in slots of its own (`createForecast`, for one moment). */
export const weatherAt = (kind: ActivityKind, globe: Globe, time: number) =>
  createForecast().at(kind, globe, time);
