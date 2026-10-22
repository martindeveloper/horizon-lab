/**
 * The Sun a renderer draws each frame, and the model that fills it. `createSunModel(seed)`
 * returns one reused `SunFrame`: the weather (`model/activity.ts`) in its slots, the field lines
 * (`model/field.ts`) re-traced only when the field has changed, the eruption (`model/eruption.ts`)
 * extruded into an arcade over its region. Positions are in the body frame, y the pole, in R☉;
 * see `model/contract.ts` for the shape.
 */
import { TAU, wrap, type Vec3 } from "@horizon/toolkit/math";

import { createForecast, goesClassOf } from "./model/activity";
import type {
  Eruption,
  Polyline,
  Prominence,
  Region,
  SunFrame,
  SunFrameInput,
} from "./model/contract";
import { cyclePhaseOf } from "./model/cycle";
import { dice } from "./model/dice";
import { blankEruptionState, blankPlaneLine, contours, eruptionAt } from "./model/eruption";
import { eruptionFlow, FLOW_PARTICLES } from "./model/eruption-flow";
import { blankEruptionLine, eruptionLines } from "./model/eruption-lines";
import { blankPolyline, fieldLines, poleOf, setSources, surfacePoint } from "./model/field";
import type { ObservedRegion } from "./model/observed";
import {
  ARCADE_SLICES,
  CHROMOSPHERE_THICKNESS_KM,
  EQUATORIAL_DIPOLE,
  ERUPTION_LINES,
  MAP_EPOCH,
  MAX_FIELD_LINES,
  RADIUS_M,
  SOURCE_SURFACE_R,
} from "./model/parameters";
import { parkerAt } from "./model/parker";
import { surfaceRate } from "./model/rotation";
import { LAYERS } from "./model/structure";

export {
  AR_13664,
  MAP_CENTRAL_MERIDIAN_DEG,
  OBSERVED_REGIONS,
  centralMeridianAt,
  type ObservedRegion,
} from "./model/observed";
export { MAP_EPOCH } from "./model/parameters";
export { bipoleAxis, northAt, surfacePoint, tiltedAxis, westAt } from "./model/field";
export type {
  Eruption,
  PassbandId,
  Polyline,
  Prominence,
  Region,
  SunFrame,
  SunFrameInput,
} from "./model/contract";

/**
 * The axial dipole's signed strength at a cycle count: full at minimum, zero at maximum, reversed
 * after; its sign at a minimum is the north pole's, which `haleLeadingNorth` makes the cycle's
 * northern leading polarity (positive for cycle 25).
 */
export const dipoleAt = (cycleCount: number) => -Math.cos(Math.PI * cycleCount);
/** The equatorial dipole's signed strength: none at minimum, `EQUATORIAL_DIPOLE` of the polar field at maximum. */
export const equatorialDipoleAt = (cycleCount: number) =>
  EQUATORIAL_DIPOLE * Math.sin(Math.PI * cycleCount);
/** Where the equatorial dipole points, body frame: fixed for a seed. */
const EQUATORIAL_LON_SALT = 30;

/** How finely a region's state is read before the field is traced again. */
const RETRACE_STRENGTH_STEP = 0.05;
const RETRACE_LON_STEP = 0.02;
const RETRACE_DIPOLE_STEP = 0.02;

/** A cheap signature of what shapes the field: retrace when it changes. */
function fieldKey(dipole: number, equatorial: number, regions: readonly Region[], count: number) {
  let key = `${Math.round(dipole / RETRACE_DIPOLE_STEP)}:${Math.round(equatorial / RETRACE_DIPOLE_STEP)}:${count}`;
  for (const region of regions) {
    if (region.strength <= 0) continue;
    key += `|${region.id}:${Math.round(region.strength / RETRACE_STRENGTH_STEP)}:${Math.round(region.lon / RETRACE_LON_STEP)}:${region.flare > 0.1 ? 1 : 0}`;
  }
  return key;
}

export type SunModelOptions = {
  /** Regions to start the visit with, in the first slots (`OBSERVED_REGIONS`: the map's); the weather takes over as they decay. */
  observed?: readonly ObservedRegion[];
};

/** The Sun model for one seed: `frameAt` fills and returns the same frame each call. */
export function createSunModel(seed: number, options: SunModelOptions = {}) {
  const forecast = createForecast(undefined, options.observed ?? []);
  const { weather } = forecast;
  const lines = Array.from({ length: MAX_FIELD_LINES }, blankPolyline);
  const planeLines = Array.from({ length: ERUPTION_LINES }, blankPlaneLine);
  const arcade = Array.from({ length: ERUPTION_LINES * ARCADE_SLICES }, blankEruptionLine);
  const eruptionState = blankEruptionState();
  const eruption: Eruption = {
    regionId: 0,
    s: 0,
    ropeHeight: 0,
    sheetBottom: 0,
    sheetTop: 0,
    reconnection: 0,
    flareLight: 0,
    goesClass: "",
    ribbonGap: 0,
    cmeFront: 1,
    cmeSpread: 0,
    cmePresence: 0,
    lines: [],
    flow: new Float32Array(3 * FLOW_PARTICLES),
  };
  const frame: SunFrame = {
    time: 0,
    cyclePhase: 0,
    dipole: 1,
    light: "white",
    regions: weather.regions,
    prominences: weather.prominences,
    fieldLines: [],
    fieldRevision: 0,
    eruptionRevision: 0,
    eruption: null,
    wolfNumber: 0,
    surfaceTurn: 0,
  };
  let lastKey = "";
  let lastEruptionKey = "";
  const equatorialLon = TAU * dice(seed, EQUATORIAL_LON_SALT);

  function frameAt(input: SunFrameInput): SunFrame {
    forecast.at(seed, input.time, input.cyclePhase, input.eruptionScrub);
    frame.time = input.time;
    frame.cyclePhase = cyclePhaseOf(input.cyclePhase);
    frame.dipole = dipoleAt(input.cyclePhase);
    frame.light = input.light;
    frame.wolfNumber = weather.wolfNumber;
    frame.surfaceTurn = wrap(surfaceRate(0) * input.time, TAU);

    const equatorial = equatorialDipoleAt(input.cyclePhase);
    setSources({
      dipole: frame.dipole,
      regions: weather.regions,
      equatorial: { strength: equatorial, lon: equatorialLon },
    });
    const count = Math.max(0, Math.min(MAX_FIELD_LINES, Math.floor(input.fieldLineCount)));
    const key = fieldKey(frame.dipole, equatorial, weather.regions, count);
    if (key !== lastKey) {
      lastKey = key;
      frame.fieldRevision++;
      const used = fieldLines(seed, count, lines);
      frame.fieldLines.length = used;
      for (let i = 0; i < used; i++) frame.fieldLines[i] = lines[i]!;
    }

    const { outbreak } = weather;
    if (outbreak.slot < 0) {
      if (frame.eruption) frame.eruptionRevision++;
      lastEruptionKey = "";
      frame.eruption = null;
      return frame;
    }
    const region = weather.regions[outbreak.slot]!;
    eruptionAt(outbreak.s, eruptionState);
    const eruptionKey = [
      outbreak.s,
      region.id,
      region.lat,
      region.lon,
      region.tilt,
      region.size,
      region.strength,
      region.polarity,
    ].join(":");
    if (eruptionKey !== lastEruptionKey) {
      lastEruptionKey = eruptionKey;
      frame.eruptionRevision++;
      const planeCount = contours(outbreak.s, ERUPTION_LINES, planeLines, eruptionState.geometry);
      const used = eruptionLines(region, planeLines, planeCount, arcade);
      eruption.lines.length = used;
      for (let i = 0; i < used; i++) eruption.lines[i] = arcade[i]!;
      eruptionFlow(region, eruptionState.geometry, eruption.flow);
    }
    eruption.regionId = outbreak.regionId;
    eruption.s = eruptionState.s;
    eruption.ropeHeight = eruptionState.ropeHeight;
    eruption.sheetBottom = eruptionState.sheetBottom;
    eruption.sheetTop = eruptionState.sheetTop;
    eruption.reconnection = eruptionState.reconnection;
    eruption.flareLight = eruptionState.flareLight;
    eruption.goesClass = goesClassOf(outbreak.flux);
    eruption.ribbonGap = eruptionState.ribbonGap;
    eruption.cmeFront = eruptionState.cmeFront;
    eruption.cmeSpread = eruptionState.cmeSpread;
    eruption.cmePresence = eruptionState.cmePresence;
    frame.eruption = eruption;
    return frame;
  }

  return { frameAt, frame };
}

export type SunModel = ReturnType<typeof createSunModel>;

/** The places the lab names; each is anchored on what the frame shows of it. */
export const PLACE_IDS = [
  "star",
  "core",
  "radiativeZone",
  "tachocline",
  "convectionZone",
  "photosphere",
  "granule",
  "sunspot",
  "facula",
  "chromosphere",
  "spicule",
  "prominence",
  "flare",
  "loops",
  "corona",
  "streamer",
  "ejection",
  "wind",
  "parker",
] as const;
export type PlaceId = (typeof PLACE_IDS)[number];

/**
 * Interior anchors lie on the +z meridian (lon = π/2 in the body frame), where the cut opens when
 * it faces the camera; a renderer turns each onto a face of the cut. Their latitude sets the
 * layers' names apart up the face, enough that neighbours clear each other on a phone.
 */
const CUT_LAT = 0.6;
const CUT_LON = Math.PI / 2;
/** The quiet-surface anchors sit just off the disc's centre. */
const SURFACE_LAT = 0.12;
const SURFACE_LON = 0.2;
/** The limb anchors, on the +x limb (lon = 0) as seen down −z. */
const LIMB_LON = 0;
const CHROMOSPHERE_TOP_R = 1 + (CHROMOSPHERE_THICKNESS_KM * 1e3) / RADIUS_M;
const SPICULE_TOP_R = 1 + (5 * CHROMOSPHERE_THICKNESS_KM * 1e3) / RADIUS_M;
const CORONA_ANCHOR_R = 1.6;

/** Parker Solar Probe at a frame's moment (its model seconds past `MAP_EPOCH`): world axes, solar radii. */
export const parkerOf = (frame: SunFrame, out: Vec3): Vec3 =>
  parkerAt(MAP_EPOCH + frame.time * 1000, out);
const parkerWorld: Vec3 = [0, 0, 0];
const at = (lat: number, lon: number, radius: number): Vec3 => {
  const p = surfacePoint(lat, lon);
  return [p[0] * radius, p[1] * radius, p[2] * radius];
};
const strongest = (frame: SunFrame) =>
  frame.regions.reduce<Region | null>(
    (best, region) =>
      region.strength > 0 && (!best || region.strength * region.size > best.strength * best.size)
        ? region
        : best,
    null,
  );
const regionById = (frame: SunFrame, id: number) =>
  frame.regions.find((region) => region.id === id && region.strength > 0) ?? null;
const apexOf = (line: Polyline): Vec3 => {
  let best = 0;
  let r2 = 0;
  for (let i = 0; i < line.count; i++) {
    const x = line.points[3 * i]!;
    const y = line.points[3 * i + 1]!;
    const z = line.points[3 * i + 2]!;
    const d = x * x + y * y + z * z;
    if (d > r2) {
      r2 = d;
      best = i;
    }
  }
  return [line.points[3 * best]!, line.points[3 * best + 1]!, line.points[3 * best + 2]!];
};

/**
 * Where a named place is in this frame, body frame, R☉; null when the frame has none of it
 * (no spot on the Sun, no eruption under way). Interior places sit on the cut's meridian at
 * the middle of their layer; the surface ones on the live region, prominence, loop or line.
 */
export function placeAnchor(frame: SunFrame, place: PlaceId): Vec3 | null {
  switch (place) {
    /* The star as a whole has no one point to name. */
    case "star":
      return null;
    /* The probe on its orbit at the model's moment, in the world; the body turns under it. */
    case "parker": {
      const [x, y, z] = parkerOf(frame, parkerWorld);
      const c = Math.cos(frame.surfaceTurn);
      const s = Math.sin(frame.surfaceTurn);
      return [x * c - z * s, y, x * s + z * c];
    }
    case "core":
      return at(CUT_LAT, CUT_LON, LAYERS.core / 2);
    case "radiativeZone":
      return at(CUT_LAT, CUT_LON, (LAYERS.core + LAYERS.tachocline) / 2);
    case "tachocline":
      return at(CUT_LAT, CUT_LON, LAYERS.tachocline);
    case "convectionZone":
      return at(CUT_LAT, CUT_LON, (LAYERS.tachocline + LAYERS.photosphere) / 2);
    case "photosphere":
      return at(CUT_LAT, CUT_LON, LAYERS.photosphere);
    case "granule":
      return at(SURFACE_LAT, SURFACE_LON, 1);
    case "sunspot": {
      const region = strongest(frame);
      return region ? at(region.lat, region.lon, 1) : null;
    }
    case "facula": {
      const region = strongest(frame);
      return region ? poleOf(region, "following") : null;
    }
    case "chromosphere":
      return at(0, LIMB_LON, CHROMOSPHERE_TOP_R);
    case "spicule":
      return at(SURFACE_LAT, LIMB_LON, SPICULE_TOP_R);
    case "prominence": {
      let best: Prominence | null = null;
      for (const prominence of frame.prominences)
        if (
          prominence.fade > 0 &&
          (!best || prominence.fade * prominence.height > best.fade * best.height)
        )
          best = prominence;
      return best ? at(best.lat, best.lon, 1 + best.height * (1 + best.lift)) : null;
    }
    case "flare": {
      const { eruption } = frame;
      const region = eruption && regionById(frame, eruption.regionId);
      return region ? at(region.lat, region.lon, 1 + eruption.sheetBottom) : null;
    }
    case "loops": {
      const { eruption } = frame;
      const region = eruption ? regionById(frame, eruption.regionId) : strongest(frame);
      if (!region) return null;
      return at(region.lat, region.lon, 1 + (eruption ? eruption.sheetBottom : region.size));
    }
    case "corona":
      return at(0, LIMB_LON, CORONA_ANCHOR_R);
    case "streamer": {
      let best: Polyline | null = null;
      let height = 0;
      for (const line of frame.fieldLines) {
        if (line.open) continue;
        const apex = apexOf(line);
        const r = Math.hypot(apex[0], apex[1], apex[2]);
        if (r > height) {
          height = r;
          best = line;
        }
      }
      return best ? apexOf(best) : null;
    }
    case "ejection": {
      const { eruption } = frame;
      const region =
        eruption && eruption.cmePresence > 0 ? regionById(frame, eruption.regionId) : null;
      return region && eruption ? at(region.lat, region.lon, eruption.cmeFront) : null;
    }
    case "wind": {
      const open = frame.fieldLines.find((line) => line.open);
      if (!open) return at(Math.PI / 2, 0, SOURCE_SURFACE_R);
      const last = open.count - 1;
      return [open.points[3 * last]!, open.points[3 * last + 1]!, open.points[3 * last + 2]!];
    }
  }
}
