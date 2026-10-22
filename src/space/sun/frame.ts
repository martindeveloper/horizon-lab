/**
 * The Sun a renderer draws each frame, and the model that fills it. `createSunModel(seed)`
 * returns one reused `SunFrame`: the weather (`model/activity.ts`) in its slots, the field lines
 * (`model/field.ts`) re-traced only when the field has changed, the eruption (`model/eruption.ts`)
 * extruded into an arcade over its region. Positions are in the body frame, y the pole, in R☉;
 * see `model/contract.ts` for the shape.
 */
import type { Elements } from "@horizon/toolkit/bodies";
import { TAU, wrap, type Vec3 } from "@horizon/toolkit/math";

import { createForecast, goesClassOf } from "./model/activity";
import type { Eruption, Region, SunFrame, SunFrameInput } from "./model/contract";
import { cyclePhaseOf } from "./model/cycle";
import { dice } from "./model/dice";
import { blankEruptionState, blankPlaneLine, contours, eruptionAt } from "./model/eruption";
import { eruptionFlow, FLOW_PARTICLES } from "./model/eruption-flow";
import { blankEruptionLine, eruptionLines } from "./model/eruption-lines";
import { blankPolyline, fieldLines, setSources } from "./model/field";
import type { ObservedRegion } from "./model/observed";
import {
  ARCADE_SLICES,
  EQUATORIAL_DIPOLE,
  ERUPTION_LINES,
  MAP_EPOCH,
  MAX_FIELD_LINES,
} from "./model/parameters";
import { parkerAt, parkerElements } from "./model/parker";
import { surfaceRate } from "./model/rotation";

export {
  AR_13664,
  MAP_CENTRAL_MERIDIAN_DEG,
  OBSERVED_REGIONS,
  centralMeridianAt,
  type ObservedRegion,
} from "./model/observed";
export { MAP_EPOCH } from "./model/parameters";
export { bipoleAxis, northAt, poleOf, surfacePoint, tiltedAxis, westAt } from "./model/field";
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

/**
 * A signature that says when what it is written from has changed: written value by value each
 * frame into a reused array, then compared with the last.
 */
function createSignature() {
  let last: number[] = [];
  let next: number[] = [];
  return {
    write(value: number) {
      next.push(value);
    },
    /** True when this frame's values differ from the last frame's; starts the next. */
    changed() {
      const same = next.length === last.length && next.every((value, i) => value === last[i]);
      [last, next] = [next, last];
      next.length = 0;
      return !same;
    },
    reset() {
      last.length = 0;
      next.length = 0;
    },
  };
}

/** What shapes the field, as finely as it is read: retrace when it changes. */
function signField(
  signature: ReturnType<typeof createSignature>,
  dipole: number,
  equatorial: number,
  regions: readonly Region[],
  count: number,
) {
  signature.write(Math.round(dipole / RETRACE_DIPOLE_STEP));
  signature.write(Math.round(equatorial / RETRACE_DIPOLE_STEP));
  signature.write(count);
  for (const region of regions) {
    if (region.strength <= 0) continue;
    signature.write(region.id);
    signature.write(Math.round(region.strength / RETRACE_STRENGTH_STEP));
    signature.write(Math.round(region.lon / RETRACE_LON_STEP));
    signature.write(region.flare > 0.1 ? 1 : 0);
  }
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
  const fieldShape = createSignature();
  const eruptionShape = createSignature();
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
    signField(fieldShape, frame.dipole, equatorial, weather.regions, count);
    if (fieldShape.changed()) {
      frame.fieldRevision++;
      const used = fieldLines(seed, count, lines);
      frame.fieldLines.length = used;
      for (let i = 0; i < used; i++) frame.fieldLines[i] = lines[i]!;
    }

    const { outbreak } = weather;
    if (outbreak.slot < 0) {
      if (frame.eruption) frame.eruptionRevision++;
      eruptionShape.reset();
      frame.eruption = null;
      return frame;
    }
    const region = weather.regions[outbreak.slot]!;
    eruptionAt(outbreak.s, eruptionState);
    eruptionShape.write(outbreak.s);
    eruptionShape.write(region.id);
    eruptionShape.write(region.lat);
    eruptionShape.write(region.lon);
    eruptionShape.write(region.tilt);
    eruptionShape.write(region.size);
    eruptionShape.write(region.strength);
    eruptionShape.write(region.polarity);
    if (eruptionShape.changed()) {
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

/** A frame's moment as a date: its model seconds past `MAP_EPOCH`, ms since 1970. */
const msOf = (frame: SunFrame) => MAP_EPOCH + frame.time * 1000;
/** Parker Solar Probe at a frame's moment: world axes, solar radii. */
export const parkerOf = (frame: SunFrame, out: Vec3): Vec3 => parkerAt(msOf(frame), out);
/** Parker's orbit at a frame's moment, the probe where `parkerOf` puts it. */
export const parkerOrbitOf = (frame: SunFrame, out?: Elements) => parkerElements(msOf(frame), out);
