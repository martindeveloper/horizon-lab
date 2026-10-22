/**
 * The Sun's magnetic field as a potential field: a global dipole whose axial part follows the
 * cycle (full at minimum, reversed after) while an equatorial part grows towards maximum (DeRosa,
 * Brun & Hoeksema 2012), made radial at a source surface of 2.5 R as a PFSS model does (the l = 1
 * solution: a dipole plus a uniform field along its axis), and one
 * buried dipole under each active region with Hale's polarity and Joy's tilt. Lines are traced
 * by RK4 from footpoints to where they come back down (closed: a loop, a streamer's arcade) or
 * reach the source surface (open: a plume, the wind). Positions in R☉, the body frame; field in
 * tesla.
 *
 * Set the sources once a frame (`setSources`), then `fieldAt` reads the prepared dipoles.
 */
import type { Vec3 } from "@horizon/toolkit/math";
import { TAU } from "@horizon/toolkit/math";

import type { Polyline, Region } from "./contract";
import { dice } from "./dice";
import {
  FIELD_LINE_SHARES,
  FLARE_LOOP_SHARE,
  HOLE_CAP_RAD,
  LOOP_FIELD_POWER,
  LOOP_KELVIN_RANGE,
  LOOP_LENGTH_POWER,
  LOOP_REFERENCE,
  LOOP_SEED_SPREAD,
  POLAR_FIELD_T,
  RTV_EXPONENT,
  QUIET_SEED_LATITUDE_RAD,
  REGION_DIPOLE_DEPTH,
  REGION_SLOTS,
  SOURCE_SURFACE_R,
  SPOT_FIELD_T,
  TEMPERATURES,
  TRACE_MAX_POINTS,
  TRACE_STEP,
  TRACE_STEP_MIN_R,
} from "./parameters";

/**
 * What shapes the field: the axial dipole's signed strength (−1..1 of the polar field), the
 * equatorial dipole's strength and longitude (0 at minimum), and the live regions.
 */
export type FieldSources = {
  dipole: number;
  regions: readonly Region[];
  equatorial?: { strength: number; lon: number };
};

const RSS3 = SOURCE_SURFACE_R ** 3;
/** The l = 1 PFSS amplitude that puts `POLAR_FIELD_T` at the pole for a unit dipole: B_r(pole) = a (2 + Rss⁻³). */
const DIPOLE_AMPLITUDE = POLAR_FIELD_T / (2 + 1 / RSS3);
/** A point dipole's radial field peaks at about m/d³ a half-depth to the side of it. */
const SPOT_MOMENT = SPOT_FIELD_T;
/** Inside this of a dipole's centre the field is not evaluated (the region's interior). */
const NEAR_DIPOLE = 1e-4;

/* The prepared sources: the dipole's amplitude and axis, and each region's centre and moment. */
let amplitude = 0;
const dipoleAxis: Vec3 = [0, 1, 0];
let regionCount = 0;
const centres = new Float64Array(3 * REGION_SLOTS);
const moments = new Float64Array(3 * REGION_SLOTS);
const regionRefs: Region[] = [];

/** The surface point of a latitude and longitude, unit radius: (cos lat cos lon, sin lat, cos lat sin lon). */
export function surfacePoint(lat: number, lon: number, out: Vec3 = [0, 0, 0]): Vec3 {
  const c = Math.cos(lat);
  out[0] = c * Math.cos(lon);
  out[1] = Math.sin(lat);
  out[2] = c * Math.sin(lon);
  return out;
}
/** East (the direction of rotation) and north at a surface point. */
export function eastAt(lat: number, lon: number, out: Vec3 = [0, 0, 0]): Vec3 {
  out[0] = -Math.sin(lon);
  out[1] = 0;
  out[2] = Math.cos(lon);
  return out;
}
export function northAt(lat: number, lon: number, out: Vec3 = [0, 0, 0]): Vec3 {
  const s = Math.sin(lat);
  out[0] = -s * Math.cos(lon);
  out[1] = Math.cos(lat);
  out[2] = -s * Math.sin(lon);
  return out;
}

const east: Vec3 = [0, 0, 0];
const north: Vec3 = [0, 0, 0];
const centre: Vec3 = [0, 0, 0];

/**
 * The bipole's axis from the following pole to the leading one: ahead in rotation and, by Joy's
 * tilt, equatorward of it.
 */
export function bipoleAxis(region: Region, out: Vec3 = [0, 0, 0]): Vec3 {
  eastAt(region.lat, region.lon, east);
  northAt(region.lat, region.lon, north);
  const poleward = region.lat >= 0 ? 1 : -1;
  const c = Math.cos(region.tilt);
  const s = Math.sin(region.tilt) * poleward;
  out[0] = east[0] * c - north[0] * s;
  out[1] = east[1] * c - north[1] * s;
  out[2] = east[2] * c - north[2] * s;
  return out;
}

/** A region's leading (+axis) or following pole on the surface, unit radius. */
export function poleOf(
  region: Region,
  which: "leading" | "following",
  out: Vec3 = [0, 0, 0],
): Vec3 {
  surfacePoint(region.lat, region.lon, centre);
  bipoleAxis(region, out);
  const sign = which === "leading" ? 1 : -1;
  out[0] = centre[0] + sign * region.size * out[0];
  out[1] = centre[1] + sign * region.size * out[1];
  out[2] = centre[2] + sign * region.size * out[2];
  const n = Math.hypot(out[0], out[1], out[2]);
  out[0] /= n;
  out[1] /= n;
  out[2] /= n;
  return out;
}

const axis: Vec3 = [0, 0, 0];

/** Prepares the frame's sources: the global dipole's amplitude and each live region's buried dipole. */
export function setSources(sources: FieldSources) {
  const eq = sources.equatorial;
  const mx = eq ? eq.strength * Math.cos(eq.lon) : 0;
  const mz = eq ? eq.strength * Math.sin(eq.lon) : 0;
  const m = Math.hypot(mx, sources.dipole, mz);
  amplitude = DIPOLE_AMPLITUDE * m;
  if (m > 0) {
    dipoleAxis[0] = mx / m;
    dipoleAxis[1] = sources.dipole / m;
    dipoleAxis[2] = mz / m;
  } else {
    dipoleAxis[0] = 0;
    dipoleAxis[1] = 1;
    dipoleAxis[2] = 0;
  }
  regionCount = 0;
  regionRefs.length = 0;
  for (const region of sources.regions) {
    if (region.strength <= 0 || regionCount >= REGION_SLOTS) continue;
    const depth = REGION_DIPOLE_DEPTH * region.size;
    surfacePoint(region.lat, region.lon, centre);
    bipoleAxis(region, axis);
    const m = region.polarity * SPOT_MOMENT * region.strength * depth ** 3;
    const k = 3 * regionCount;
    centres[k] = centre[0] * (1 - depth);
    centres[k + 1] = centre[1] * (1 - depth);
    centres[k + 2] = centre[2] * (1 - depth);
    moments[k] = m * axis[0];
    moments[k + 1] = m * axis[1];
    moments[k + 2] = m * axis[2];
    regionRefs.push(region);
    regionCount++;
  }
}

/** The field at `p` (R☉, body frame), tesla, from the prepared sources. */
export function fieldAt(p: Readonly<Vec3>, out: Vec3 = [0, 0, 0]): Vec3 {
  const [x, y, z] = p;
  const r2 = x * x + y * y + z * z;
  const r = Math.sqrt(r2);
  const r3 = r2 * r;
  /* The PFSS dipole along m̂: a [(3 (m̂·r̂) r̂ − m̂) / r³ + m̂ / Rss³]. */
  const [ax, ay, az] = dipoleAxis;
  const mr = (ax * x + ay * y + az * z) / r;
  out[0] = amplitude * ((3 * mr * (x / r) - ax) / r3 + ax / RSS3);
  out[1] = amplitude * ((3 * mr * (y / r) - ay) / r3 + ay / RSS3);
  out[2] = amplitude * ((3 * mr * (z / r) - az) / r3 + az / RSS3);
  for (let i = 0; i < regionCount; i++) {
    const k = 3 * i;
    const dx = x - centres[k]!;
    const dy = y - centres[k + 1]!;
    const dz = z - centres[k + 2]!;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < NEAR_DIPOLE * NEAR_DIPOLE) continue;
    const d = Math.sqrt(d2);
    const d3 = d2 * d;
    const mx = moments[k]!;
    const mdy = moments[k + 1]!;
    const mz = moments[k + 2]!;
    const dot = (mx * dx + mdy * dy + mz * dz) / d2;
    out[0] += (3 * dot * dx - mx) / d3;
    out[1] += (3 * dot * dy - mdy) / d3;
    out[2] += (3 * dot * dz - mz) / d3;
  }
  return out;
}

const field: Vec3 = [0, 0, 0];
const point: Vec3 = [0, 0, 0];

/** The radial field at a surface point, tesla, signed outward. */
export function radialFieldAt(lat: number, lon: number) {
  surfacePoint(lat, lon, point);
  fieldAt(point, field);
  return field[0] * point[0] + field[1] * point[1] + field[2] * point[2];
}

/** A line with room for the most points a trace keeps. */
export const blankPolyline = (): Polyline => ({
  points: new Float32Array(3 * TRACE_MAX_POINTS),
  count: 0,
  polarity: 1,
  open: false,
  strength: 0,
  kelvin: TEMPERATURES.quietCorona,
});

export type TraceOptions = {
  /** The length the step is a share of: a region's size for its loops, the radius for global lines. */
  scale?: number;
  /** Follow the field inward from the footpoint rather than outward. */
  inward?: boolean;
  maxPoints?: number;
};

const k1: Vec3 = [0, 0, 0];
const k2: Vec3 = [0, 0, 0];
const k3: Vec3 = [0, 0, 0];
const k4: Vec3 = [0, 0, 0];
const mid: Vec3 = [0, 0, 0];
const cur: Vec3 = [0, 0, 0];

/** The unit field direction at `p`, times `sign`. */
function direction(p: Readonly<Vec3>, sign: number, out: Vec3) {
  fieldAt(p, out);
  const n = Math.hypot(out[0], out[1], out[2]) || 1;
  out[0] *= sign / n;
  out[1] *= sign / n;
  out[2] *= sign / n;
}

/**
 * Traces the line through `start` (on or above the surface) along the field, outward from the
 * footpoint, by RK4 with a step scaled to the local structure, until it comes down to the
 * surface (closed) or reaches the source surface (open). Writes `line`; returns it.
 */
export function traceLine(start: Readonly<Vec3>, line: Polyline, options: TraceOptions = {}) {
  const maxPoints = Math.min(options.maxPoints ?? TRACE_MAX_POINTS, line.points.length / 3);
  fieldAt(start, field);
  const r0 = Math.hypot(start[0], start[1], start[2]) || 1;
  const radial = (field[0] * start[0] + field[1] * start[1] + field[2] * start[2]) / r0;
  const sign = (radial >= 0 ? 1 : -1) * (options.inward ? -1 : 1);
  line.polarity = radial >= 0 ? 1 : -1;
  line.strength = Math.hypot(field[0], field[1], field[2]) / POLAR_FIELD_T;
  line.open = false;
  cur[0] = start[0];
  cur[1] = start[1];
  cur[2] = start[2];
  let count = 0;
  const put = (p: Readonly<Vec3>) => {
    line.points[3 * count] = p[0];
    line.points[3 * count + 1] = p[1];
    line.points[3 * count + 2] = p[2];
    count++;
  };
  put(cur);
  const scale = options.scale ?? 1;
  for (;;) {
    if (count >= maxPoints) break;
    const r = Math.hypot(cur[0], cur[1], cur[2]);
    const h = Math.max(TRACE_STEP_MIN_R, TRACE_STEP * (options.scale === undefined ? r : scale));
    direction(cur, sign, k1);
    mid[0] = cur[0] + 0.5 * h * k1[0];
    mid[1] = cur[1] + 0.5 * h * k1[1];
    mid[2] = cur[2] + 0.5 * h * k1[2];
    direction(mid, sign, k2);
    mid[0] = cur[0] + 0.5 * h * k2[0];
    mid[1] = cur[1] + 0.5 * h * k2[1];
    mid[2] = cur[2] + 0.5 * h * k2[2];
    direction(mid, sign, k3);
    mid[0] = cur[0] + h * k3[0];
    mid[1] = cur[1] + h * k3[1];
    mid[2] = cur[2] + h * k3[2];
    direction(mid, sign, k4);
    const px = cur[0];
    const py = cur[1];
    const pz = cur[2];
    cur[0] += (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    cur[1] += (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    cur[2] += (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    const rn = Math.hypot(cur[0], cur[1], cur[2]);
    if (rn >= SOURCE_SURFACE_R) {
      /* Clip to the source surface. */
      const t = (SOURCE_SURFACE_R - r) / (rn - r);
      cur[0] = px + (cur[0] - px) * t;
      cur[1] = py + (cur[1] - py) * t;
      cur[2] = pz + (cur[2] - pz) * t;
      put(cur);
      line.open = true;
      break;
    }
    if (rn < 1 && count > 1) {
      /* Clip to the surface. */
      const t = (1 - r) / (rn - r);
      cur[0] = px + (cur[0] - px) * t;
      cur[1] = py + (cur[1] - py) * t;
      cur[2] = pz + (cur[2] - pz) * t;
      put(cur);
      break;
    }
    put(cur);
  }
  line.count = count;
  return line;
}

const probe = blankPolyline();
/** Whether the line from a surface point is open to the wind (1) or closes back down (0). */
export function openness(lat: number, lon: number) {
  surfacePoint(lat, lon, point);
  traceLine(point, probe, { maxPoints: 96 });
  return probe.open ? 1 : 0;
}

/** Salts for the footpoint throws. */
const SALT = {
  holeTilt: 20,
  holeTurn: 21,
  loopAngle: 22,
  loopSpread: 23,
  quietLat: 24,
  quietLon: 25,
} as const;

/** A line's length along its points, R. */
export function lineLength(line: Polyline) {
  let length = 0;
  for (let i = 1; i < line.count; i++)
    length += Math.hypot(
      line.points[3 * i]! - line.points[3 * i - 3]!,
      line.points[3 * i + 1]! - line.points[3 * i - 2]!,
      line.points[3 * i + 2]! - line.points[3 * i - 1]!,
    );
  return length;
}

/**
 * A loop's temperature from its footpoint field (tesla) and length (R) by the RTV scaling with
 * braiding heating, T = T₀ (B² L / B₀² L₀)^(2/7), within the observed range.
 */
export function loopTemperature(fieldT: number, lengthR: number) {
  const { kelvin, fieldT: b0, lengthR: l0 } = LOOP_REFERENCE;
  const measure = (fieldT / b0) ** LOOP_FIELD_POWER * (lengthR / l0) ** LOOP_LENGTH_POWER;
  const t = kelvin * measure ** RTV_EXPONENT;
  return Math.min(LOOP_KELVIN_RANGE[1], Math.max(LOOP_KELVIN_RANGE[0], t));
}

/** A region loop's temperature: the RTV rule, or the flare's for the hotter half of a flaring region. */
function regionLoopKelvin(line: Polyline, region: Region) {
  const t = loopTemperature(line.strength * POLAR_FIELD_T, lineLength(line));
  const share = (t - LOOP_KELVIN_RANGE[0]) / (LOOP_KELVIN_RANGE[1] - LOOP_KELVIN_RANGE[0]);
  return region.flare > 0.1 && share >= FLARE_LOOP_SHARE ? TEMPERATURES.flare : t;
}

const u: Vec3 = [0, 0, 0];
const v: Vec3 = [0, 0, 0];
/** A unit direction within `cap` of `axis` (or, with `sign` −1, of its opposite), from two throws. */
function aboutAxis(
  axis: Readonly<Vec3>,
  sign: number,
  cap: number,
  tilt: number,
  turn: number,
  out: Vec3,
) {
  const [ax, ay, az] = axis;
  /* An orthonormal pair across the axis. */
  if (Math.abs(ay) < 0.9) {
    u[0] = -az;
    u[1] = 0;
    u[2] = ax;
  } else {
    u[0] = 0;
    u[1] = az;
    u[2] = -ay;
  }
  const nu = Math.hypot(u[0], u[1], u[2]) || 1;
  u[0] /= nu;
  u[1] /= nu;
  u[2] /= nu;
  v[0] = ay * u[2] - az * u[1];
  v[1] = az * u[0] - ax * u[2];
  v[2] = ax * u[1] - ay * u[0];
  const theta = cap * Math.sqrt(tilt);
  const phi = TAU * turn;
  const s = Math.sin(theta);
  const c = Math.cos(theta) * sign;
  out[0] = c * ax + s * (Math.cos(phi) * u[0] + Math.sin(phi) * v[0]);
  out[1] = c * ay + s * (Math.cos(phi) * u[1] + Math.sin(phi) * v[1]);
  out[2] = c * az + s * (Math.cos(phi) * u[2] + Math.sin(phi) * v[2]);
  return out;
}

const pole: Vec3 = [0, 0, 0];

/**
 * Fills `lines[0 … count)` with this frame's field lines from `setSources`' sources: open lines
 * from the polar caps, loops over each live region (shared by strength) seeded about its leading
 * pole, and quiet-Sun lines between; a line's temperature says what it is. Returns the lines used.
 */
export function fieldLines(seed: number, count: number, lines: Polyline[]) {
  const total = Math.min(count, lines.length);
  let used = 0;
  const live = regionRefs;
  const holes = Math.round(total * FIELD_LINE_SHARES.holes);
  const regionLines = live.length ? Math.round(total * FIELD_LINE_SHARES.regions) : 0;

  /* The coronal holes sit at the dipole's two poles: the polar caps at minimum, low latitudes at maximum. */
  for (let i = 0; i < holes && used < total; i++) {
    const sign = i % 2 === 0 ? 1 : -1;
    aboutAxis(
      dipoleAxis,
      sign,
      HOLE_CAP_RAD,
      dice(seed, SALT.holeTilt, i),
      dice(seed, SALT.holeTurn, i),
      point,
    );
    const line = lines[used++]!;
    traceLine(point, line);
    line.kelvin = line.open ? TEMPERATURES.coronalHole : TEMPERATURES.quietCorona;
  }

  if (regionLines > 0) {
    const weight = live.reduce((sum, region) => sum + region.strength, 0) || 1;
    let given = 0;
    live.forEach((region, index) => {
      const share =
        index === live.length - 1
          ? regionLines - given
          : Math.round((regionLines * region.strength) / weight);
      given += share;
      poleOf(region, "leading", pole);
      eastAt(region.lat, region.lon, east);
      northAt(region.lat, region.lon, north);
      for (let j = 0; j < share && used < total; j++) {
        const angle = TAU * dice(seed, SALT.loopAngle, index, j);
        const spread =
          region.size *
          (LOOP_SEED_SPREAD[0] +
            (LOOP_SEED_SPREAD[1] - LOOP_SEED_SPREAD[0]) * dice(seed, SALT.loopSpread, index, j));
        point[0] = pole[0] + spread * (Math.cos(angle) * east[0] + Math.sin(angle) * north[0]);
        point[1] = pole[1] + spread * (Math.cos(angle) * east[1] + Math.sin(angle) * north[1]);
        point[2] = pole[2] + spread * (Math.cos(angle) * east[2] + Math.sin(angle) * north[2]);
        const n = Math.hypot(point[0], point[1], point[2]);
        point[0] /= n;
        point[1] /= n;
        point[2] /= n;
        const line = lines[used++]!;
        traceLine(point, line, { scale: region.size });
        line.kelvin = line.open ? TEMPERATURES.coronalHole : regionLoopKelvin(line, region);
      }
    });
  }

  for (let i = 0; used < total; i++) {
    const lat = Math.asin(
      Math.sin(QUIET_SEED_LATITUDE_RAD) * (2 * dice(seed, SALT.quietLat, i) - 1),
    );
    const lon = TAU * dice(seed, SALT.quietLon, i);
    surfacePoint(lat, lon, point);
    const line = lines[used++]!;
    traceLine(point, line);
    line.kelvin = line.open ? TEMPERATURES.coronalHole : TEMPERATURES.quietCorona;
  }
  return used;
}
