/**
 * What every Sun layer draws with: the uniforms they share (the light, the cut, the clocks,
 * the regions, the eruption, the gamut), written once a frame by the engine and read by the
 * globe, the atmosphere and the ribbons. Each layer spreads what it needs into its material.
 */
import { Matrix3, Vector2, Vector3, Vector4 } from "three";

import { gamutMatrix } from "@horizon/toolkit/rendering";
import { SOLAR_GOLD } from "@horizon/toolkit/scene";
import { hexToLinear, wavelengthColor, type Gamut } from "@horizon/toolkit/science";

import {
  CORE_SHIMMER_S,
  HOLE_MAX,
  STREAMER_MAX,
  E_CORONA_NM,
  EVERSHED_RADII_PER_S,
  GRANULE_LIFETIME_S,
  LIGHT_MODES,
  NEGATIVE_HEX,
  NETWORK_LIFETIME_S,
  PLUME_RISE_RADII_PER_S,
  POSITIVE_HEX,
  PROMINENCE_MAX,
  RADIATIVE_DRIFT_S,
  RIBBON_GAP,
  REGION_MAX,
  SPICULE_LIFETIME_S,
} from "../parameters";
import { bipoleAxis, directionOf, tiltedAxis, type PassbandId, type SunFrame } from "./frame";
import type { SunLight } from "./settings";

/** A clock wraps here so its float stays precise; a wrap is a jump no one sees. */
const CLOCK_WRAP = 1e5;

/** How a light is drawn, by its id (`LIGHT_MODES`). */
export function lightModeOf(id: PassbandId) {
  const mode = id === "white" || id === "eclipse" || id === "magnetogram" ? id : "band";
  return LIGHT_MODES.indexOf(mode);
}

/** The Balmer pink of an eclipse's chromosphere (encoded sRGB), as Giants draws it. */
const BALMER_HEX = "#ff546b";

const linear = (hex: string) => new Vector3(...hexToLinear(hex));

export function createSunLooks() {
  const regionDir = Array.from({ length: REGION_MAX }, () => new Vector4());
  const regionAxis = Array.from({ length: REGION_MAX }, () => new Vector4());
  const regionSide = Array.from({ length: REGION_MAX }, () => new Vector4());
  const regionState = Array.from({ length: REGION_MAX }, () => new Vector4());
  const prominenceAt = Array.from({ length: PROMINENCE_MAX }, () => new Vector4());
  const prominenceAlong = Array.from({ length: PROMINENCE_MAX }, () => new Vector4());
  const green = wavelengthColor(E_CORONA_NM);
  const lightUniforms = {
    uLightMode: { value: 0 },
    uBandScale: { value: 1 },
    uWeights: { value: new Vector4(1, 0, 0, 0) },
    uFlareWeight: { value: 1 },
  };
  const activityUniforms = {
    uProminenceCount: { value: 0 },
    uProminence: { value: prominenceAt },
    uProminenceAlong: { value: prominenceAlong },
    uStreamerCount: { value: 0 },
    uStreamer: { value: Array.from({ length: STREAMER_MAX }, () => new Vector4()) },
    uHoleCount: { value: 0 },
    uHole: { value: Array.from({ length: HOLE_MAX }, () => new Vector4()) },
    uRegionCount: { value: 0 },
    uRegionDir: { value: regionDir },
    uRegionAxis: { value: regionAxis },
    uRegionSide: { value: regionSide },
    uRegionState: { value: regionState },
    uDipole: { value: 0 },
  };
  const motionUniforms = {
    uClock: { value: new Vector4() },
    uTurn: { value: 0 },
    uEvershed: { value: 0 },
    uPlumeRise: { value: 0 },
    uSpiculeClock: { value: 0 },
  };
  const viewUniforms = {
    uCut: { value: new Vector2(0, 0) },
    uPixelWorld: { value: 1e-3 },
    uGamut: { value: new Matrix3() },
  };
  const colourUniforms = {
    uGold: { value: new Vector3(...hexToLinear(`#${SOLAR_GOLD.toString(16).padStart(6, "0")}`)) },
    uPositive: { value: linear(POSITIVE_HEX) },
    uNegative: { value: linear(NEGATIVE_HEX) },
    uMagPositive: { value: linear(POSITIVE_HEX) },
    uMagNegative: { value: linear(NEGATIVE_HEX) },
    uBalmer: { value: linear(BALMER_HEX) },
    uGreen: { value: new Vector3(green[0], green[1], green[2]) },
  };
  const uniforms = {
    ...lightUniforms,
    ...activityUniforms,
    ...motionUniforms,
    ...viewUniforms,
    ...colourUniforms,
  };
  const dir: [number, number, number] = [0, 0, 0];
  const axis = new Vector3();
  const side = new Vector3();
  const centre = new Vector3();
  return {
    uniforms,
    /**
     * The light: its peaks for the shaders, and its exposure, 1 over the brightest layer's
     * weighted response, so each band shows what answers to it at full scale and nothing where
     * its response is zero. Returns how much a prominence (chromospheric, with a transition
     * sheath) shows in it.
     */
    /** The light's mode and layer weights; its exposure comes from the tables (`setResponse`). */
    setLight(light: SunLight, scale: number) {
      lightUniforms.uLightMode.value = lightModeOf(light.id);
      const w = light.weights;
      lightUniforms.uWeights.value.set(w.photosphere, w.chromosphere, w.transition, w.corona);
      lightUniforms.uFlareWeight.value = w.flare;
      lightUniforms.uBandScale.value =
        lightModeOf(light.id) === LIGHT_MODES.indexOf("band") ? scale : 1;
    },
    setGamut(gamut: Gamut) {
      gamutMatrix(gamut, viewUniforms.uGamut.value);
    },
    /** The frame's clocks and weather, once a frame. */
    setFrame(frame: SunFrame) {
      const t = frame.time;
      motionUniforms.uClock.value.set(
        (t / GRANULE_LIFETIME_S) % CLOCK_WRAP,
        (t / NETWORK_LIFETIME_S) % CLOCK_WRAP,
        (t / CORE_SHIMMER_S) % CLOCK_WRAP,
        (t / RADIATIVE_DRIFT_S) % CLOCK_WRAP,
      );
      motionUniforms.uTurn.value = frame.surfaceTurn;
      motionUniforms.uEvershed.value = (t * EVERSHED_RADII_PER_S) % CLOCK_WRAP;
      motionUniforms.uPlumeRise.value = (t * PLUME_RISE_RADII_PER_S) % CLOCK_WRAP;
      motionUniforms.uSpiculeClock.value = (t / SPICULE_LIFETIME_S) % CLOCK_WRAP;
      activityUniforms.uDipole.value = frame.dipole;
      const count = Math.min(frame.regions.length, REGION_MAX);
      activityUniforms.uRegionCount.value = count;
      const eruption = frame.eruption;
      for (let k = 0; k < count; k++) {
        const region = frame.regions[k]!;
        /* The erupting region's flare is the eruption's light, on its own timeline. */
        const flare =
          eruption && eruption.regionId === region.id
            ? Math.max(region.flare, eruption.flareLight)
            : region.flare;
        directionOf(region.lat, region.lon, dir);
        centre.set(dir[0], dir[1], dir[2]);
        /* The follower-to-leader axis, west and tipped equatorward by Joy's tilt (the model's); the neutral line crosses it. */
        bipoleAxis(region, dir);
        axis.set(dir[0], dir[1], dir[2]);
        side.crossVectors(centre, axis);
        regionDir[k]!.set(centre.x, centre.y, centre.z, region.size);
        regionAxis[k]!.set(axis.x, axis.y, axis.z, region.polarity);
        regionSide[k]!.set(side.x, side.y, side.z, region.strength);
        /* The ribbons' half-separation in units of the region's size: the eruption's, else the default. */
        const gap =
          eruption && eruption.regionId === region.id && eruption.ribbonGap > 0
            ? eruption.ribbonGap / (2 * region.size)
            : RIBBON_GAP;
        regionState[k]!.set(flare, region.facula, gap, region.id * 3.7);
      }
      /* The prominences' channels, for the filaments they cast on the disc. */
      const prominences = Math.min(frame.prominences.length, PROMINENCE_MAX);
      activityUniforms.uProminenceCount.value = prominences;
      for (let k = 0; k < prominences; k++) {
        const p = frame.prominences[k]!;
        directionOf(p.lat, p.lon, dir);
        centre.set(dir[0], dir[1], dir[2]);
        tiltedAxis(p.lat, p.lon, p.tilt, dir);
        axis.set(dir[0], dir[1], dir[2]);
        prominenceAt[k]!.set(centre.x, centre.y, centre.z, p.length / 2);
        prominenceAlong[k]!.set(axis.x, axis.y, axis.z, p.fade * (1 - p.erupting));
      }
    },
  };
}

export type SunLooks = ReturnType<typeof createSunLooks>;
