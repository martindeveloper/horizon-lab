/**
 * The star in focus's weather as the shader reads it (`weather.glsl`): active regions,
 * prominences laid out as columns, post-flare loops with the circles that bound them,
 * ejections and the flares' glare, in fixed slots that stay dark when empty (`weather-fade.ts`
 * says how much of it shows).
 */
import type { Weather } from "../model/activity";
import {
  ARCADES,
  EJECTIONS,
  LOOPS,
  LOOP_POINTS,
  REGIONS,
  SHEETS,
  SHEET_POINTS,
} from "../parameters";
import { vectors } from "./vectors";

/** The weather's uniforms, and `fill` to write a moment's weather into them (null: none). */
export function weatherUniforms() {
  const regions = { centre: vectors(REGIONS), state: vectors(REGIONS), view: vectors(REGIONS) };
  const sheets = { info: vectors(SHEETS), columns: vectors(SHEETS * SHEET_POINTS) };
  const loops = { bound: vectors(LOOPS), points: vectors(LOOPS * LOOP_POINTS) };
  const ejections = vectors(EJECTIONS);
  const flashes = vectors(ARCADES);
  function fill(weather: Weather | null) {
    regions.state.forEach((state, k) => {
      const region = weather?.regions[k];
      if (!region || region.strength <= 0) {
        state.setX(0);
        regions.view[k]!.setW(0);
        return;
      }
      const { centre, view } = region;
      regions.centre[k]!.set(centre[0], centre[1], centre[2], region.size);
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
      uRegionView: { value: regions.view },
      uSheetInfo: { value: sheets.info },
      uSheet: { value: sheets.columns },
      uLoopBound: { value: loops.bound },
      uLoop: { value: loops.points },
      uEjection: { value: ejections },
      uFlash: { value: flashes },
    },
    fill,
  };
}
