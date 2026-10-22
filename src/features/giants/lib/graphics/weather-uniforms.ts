/**
 * The star in focus's weather as the shader reads it (`weather.glsl`): active regions,
 * prominences laid out as columns, post-flare loops with the circles that bound them,
 * ejections and the flares' glare, in fixed slots that stay dark when empty (`weather-fade.ts`
 * says how much of it shows).
 */
import { DataTexture, FloatType, RGBAFormat, Vector3 } from "three";

import { continuumTable, stellarContinuum } from "@/space/sun/graphics/atmosphere";
import { sampleSpectrum } from "@/space/sun/graphics/spectrum-sample";

import type { Weather } from "../model/activity";
import { OUTFLOW_SLOTS } from "../model/mass-loss";
import {
  ARCADES,
  EJECTIONS,
  FLARE_K,
  LOOPS,
  LOOP_POINTS,
  REGIONS,
  SHEETS,
  SHEET_POINTS,
} from "../parameters";
import { vectors } from "./vectors";

/** The weather's uniforms, and `fill` to write a moment's weather into them (null: none). */
export function weatherUniforms(spectrum = continuumTable()) {
  const regions = { centre: vectors(REGIONS), state: vectors(REGIONS), view: vectors(REGIONS) };
  const axes = Array.from({ length: REGIONS }, () => new Vector3());
  const sides = Array.from({ length: REGIONS }, () => new Vector3());
  const east = new Vector3(),
    north = new Vector3(),
    centre = new Vector3();
  const sheets = { info: vectors(SHEETS), columns: vectors(SHEETS * SHEET_POINTS) };
  const loops = { bound: vectors(LOOPS), points: vectors(LOOPS * LOOP_POINTS) };
  const ejections = vectors(EJECTIONS);
  const directions = Array.from({ length: EJECTIONS }, () => new Vector3());
  const flashes = vectors(ARCADES);
  const sample = sampleSpectrum(spectrum, FLARE_K, new Float32Array(4));
  const flareColour = new Vector3(sample[0], sample[1], sample[2]);
  // A third texel holds each cloud's emission per unit column, shared by all its pixels.
  const outflowData = new Float32Array(OUTFLOW_SLOTS * 12);
  const outflows = new DataTexture(outflowData, 3, OUTFLOW_SLOTS, RGBAFormat, FloatType);
  outflows.needsUpdate = true;
  let hadOutflow = false;
  let referenceK = NaN;
  let face: readonly number[] = [];
  function fill(weather: Weather | null, faceKelvin?: number) {
    const hasOutflow = weather?.outflows.some((cloud) => cloud.gas + cloud.dust > 0) ?? false;
    if (hasOutflow) {
      if (faceKelvin === undefined || !Number.isFinite(faceKelvin) || faceKelvin <= 0)
        throw new Error("Active outflows need their star's reference temperature");
      if (faceKelvin !== referenceK) {
        referenceK = faceKelvin;
        face = stellarContinuum(faceKelvin).map(Math.fround);
      }
    }
    if (hasOutflow || hadOutflow) {
      outflowData.fill(0);
      if (hasOutflow)
        weather?.outflows.forEach((outflow, k) => {
          if (outflow.gas + outflow.dust <= 0) return;
          const at = k * 12;
          outflowData.set(outflow.centre, at);
          outflowData[at + 3] = outflow.width;
          outflowData[at + 4] = outflow.gas;
          outflowData[at + 5] = outflow.dust;
          outflowData[at + 6] = outflow.temperature;
          outflowData[at + 7] = outflow.seed;
          // Match the float inputs previously read by the shader, including its table lookup.
          const radius = Math.hypot(outflowData[at]!, outflowData[at + 1]!, outflowData[at + 2]!);
          const forward = 0.25 + 0.75 * Math.max(outflowData[at + 2]! / radius, 0) ** 4;
          sampleSpectrum(spectrum, outflowData[at + 6]!, sample);
          const gas = 0.35 * outflowData[at + 4]! * Math.exp(sample[3]! - face[3]!);
          const dust = (0.04 * outflowData[at + 5]! * forward) / (radius * radius);
          for (let c = 0; c < 3; c++) outflowData[at + 8 + c] = gas * sample[c]! + dust * face[c]!;
        });
      outflows.needsUpdate = true;
    }
    hadOutflow = hasOutflow;
    regions.state.forEach((state, k) => {
      const region = weather?.regions[k];
      if (!region || region.strength <= 0) {
        state.setX(0);
        regions.view[k]!.setW(0);
        return;
      }
      const { view } = region;
      centre.fromArray(region.centre);
      regions.centre[k]!.set(centre.x, centre.y, centre.z, region.size);
      // Preserve the shader's polar epsilon and handedness.
      east.set(centre.z + 1e-5, 0, -centre.x).normalize();
      north.crossVectors(centre, east);
      axes[k]!.copy(east)
        .multiplyScalar(Math.cos(region.tilt))
        .addScaledVector(north, Math.sin(region.tilt));
      sides[k]!.crossVectors(centre, axes[k]!);
      state.set(region.strength, region.tilt, region.flare, region.veil ? 1 : 0);
      regions.view[k]!.set(view[0], view[1], view[2], region.veil ? 0 : region.strength);
    });
    sheets.info.forEach((info, k) => {
      const sheet = weather?.sheets[k];
      if (!sheet || sheet.brightness <= 0) return void info.setZ(0);
      info.set(sheet.start, sheet.step, sheet.brightness, sheet.own);
      sheet.columns.forEach((column, c) =>
        sheets.columns[k * SHEET_POINTS + c]!.set(
          column.inner,
          column.outer,
          column.depth,
          sheet.hollow,
        ),
      );
    });
    loops.bound.forEach((bound, k) => {
      const loop = weather?.loops[k];
      if (!loop || loop.brightness <= 0) return void bound.setW(0);
      let x = 0;
      let y = 0;
      loop.points.forEach((point, j) => {
        loops.points[k * LOOP_POINTS + j]!.set(point[0], point[1], point[2], loop.width);
        x += point[0] / loop.points.length;
        y += point[1] / loop.points.length;
      });
      let reach = 0;
      for (const point of loop.points)
        reach = Math.max(reach, Math.hypot(point[0] - x, point[1] - y));
      bound.set(x, y, reach + loop.width * 4, loop.brightness);
    });
    ejections.forEach((ejection, k) => {
      const e = weather?.ejections[k];
      if (!e || e.brightness <= 0) return void ejection.setW(0);
      ejection.set(e.angle, e.front, e.spread, e.brightness);
      directions[k]!.set(
        Math.cos(e.angle),
        Math.sin(e.angle),
        Math.cos(Math.min(1.2 * e.spread, Math.PI)),
      );
    });
    flashes.forEach((flash, k) => {
      const lit = weather?.flashes[k];
      if (!lit || lit.strength <= 0) return void flash.setW(0);
      flash.set(lit.at[0], lit.at[1], lit.at[2], lit.strength);
    });
  }
  return {
    uniforms: {
      uRegion: { value: regions.centre },
      uRegionState: { value: regions.state },
      uRegionAxis: { value: axes },
      uRegionSide: { value: sides },
      uRegionView: { value: regions.view },
      uSheetInfo: { value: sheets.info },
      uSheet: { value: sheets.columns },
      uLoopBound: { value: loops.bound },
      uLoop: { value: loops.points },
      uEjection: { value: ejections },
      uEjectionDirection: { value: directions },
      uFlareColour: { value: flareColour },
      uFlash: { value: flashes },
      uOutflows: { value: outflows },
    },
    fill,
    dispose: () => outflows.dispose(),
  };
}
