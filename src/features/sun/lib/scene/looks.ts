/**
 * What every Sun layer draws with: the uniforms they share (the light, the cut, the clocks,
 * the regions, the eruption, the gamut), written once a frame by the engine and read by the
 * globe, the atmosphere and the ribbons. Each layer spreads what it needs into its material.
 */
import { Matrix3, Vector2, Vector3, Vector4 } from "three";

import { dice } from "@/space/sun/model/dice";
import {
  GRANULE_LIFETIME_S,
  JOY_SLOPE,
  SUPERGRANULE_LIFETIME_S,
} from "@/space/sun/model/parameters";
import { MAGNETOGRAM_NEGATIVE, MAGNETOGRAM_POSITIVE } from "@/space/sun/model/passbands";
import { gamutMatrix } from "@horizon/toolkit/rendering";
import { SOLAR_GOLD, cssHex } from "@horizon/toolkit/scene";
import { hexToLinear, wavelengthColor, type Gamut } from "@horizon/toolkit/science";

import { lightKind } from "../model/lights";
import {
  CELL_SWELL_PER_LIFE,
  CONVECTION_OCTAVES,
  HOLE_MAX,
  STREAMER_MAX,
  E_CORONA_NM,
  EVERSHED_RADII_PER_S,
  LIGHT_MODES,
  PROMINENCE_MAX,
  RIBBON_GAP,
  REGION_MAX,
  SPICULE_LIFETIME_S,
} from "../parameters";
import {
  SEEDED_GROUPS,
  bipoleAxis,
  blankPhotoDraw,
  directionOf,
  photoDrawOf,
  tiltedAxis,
  unclaimedSpotShare,
  type PassbandId,
  type SunFrame,
} from "./frame";
import type { SunLight } from "./settings";

/** A clock wraps here so its float stays precise; a wrap is a jump no one sees. */
const CLOCK_WRAP = 1e5;

export { lightKind, type LightKind } from "../model/lights";

/** How a light is drawn, by its id (`LIGHT_MODES`): Hα through its ramp, as a band is. */
export function lightModeOf(id: PassbandId) {
  const kind = lightKind(id);
  return LIGHT_MODES.indexOf(kind === "halpha" ? "band" : kind);
}

/** The Balmer pink of an eclipse's chromosphere (encoded sRGB), as Giants draws it. */
const BALMER_HEX = "#ff546b";

const linear = (hex: string) => new Vector3(...hexToLinear(hex));

export function createSunLooks() {
  const regionDir = Array.from({ length: REGION_MAX }, () => new Vector4());
  const regionAxis = Array.from({ length: REGION_MAX }, () => new Vector4());
  const regionSide = Array.from({ length: REGION_MAX }, () => new Vector4());
  const regionState = Array.from({ length: REGION_MAX }, () => new Vector4());
  const regionDonor = Array.from({ length: REGION_MAX }, () => new Vector4());
  const regionDonorAxis = Array.from({ length: REGION_MAX }, () => new Vector4());
  const regionPhoto = Array.from({ length: REGION_MAX }, () => 0);
  /* The seeded groups where the photograph has them at the epoch: fixed for the visit. */
  const seeded = Array.from({ length: REGION_MAX }, (_, k) => {
    const group = SEEDED_GROUPS[k];
    if (!group) return new Vector4();
    const [x, y, z] = directionOf(group.lat, group.lon);
    return new Vector4(x, y, z, group.reach);
  });
  const draw = blankPhotoDraw();
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
    /**
     * Each region drawn from the photograph (`photoDrawOf`): its donor's centre at the epoch and
     * reach; its donor's axis and the patch's radians per the region's; its spot area's share. The
     * seeded groups' centres at the epoch and reach, whose spots the regions draw, and how much
     * of the photograph's unclaimed spots shows.
     */
    uRegionDonor: { value: regionDonor },
    uRegionDonorAxis: { value: regionDonorAxis },
    uRegionPhoto: { value: regionPhoto },
    uSeededCount: { value: Math.min(SEEDED_GROUPS.length, REGION_MAX) },
    uSeeded: { value: seeded },
    uMapUnclaimed: { value: 1 },
    uDipole: { value: 0 },
    /** The global dipole's moment, body frame: the magnetogram's polar and equatorial field. */
    uDipoleMoment: { value: new Vector3(0, 1, 0) },
  };
  const motionUniforms = {
    uClock: { value: new Vector2() },
    /** Each convection octave: cells per radius, the radius it is centred on, its cells' clock. */
    uCellOctave: {
      value: CONVECTION_OCTAVES.map((o) => new Vector4(o.cellsPerRadius, o.radius, 0, 0)),
    },
    uTurn: { value: 0 },
    uEvershed: { value: 0 },
    uSpiculeClock: { value: 0 },
  };
  const viewUniforms = {
    uCut: { value: new Vector2(0, 0) },
    uPixelWorld: { value: 1e-3 },
    uGamut: { value: new Matrix3() },
  };
  const colourUniforms = {
    uGold: { value: linear(cssHex(SOLAR_GOLD)) },
    uPositive: { value: new Vector3(...MAGNETOGRAM_POSITIVE) },
    uNegative: { value: new Vector3(...MAGNETOGRAM_NEGATIVE) },
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
  const donorCentre = new Vector3();
  return {
    uniforms,
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
        (t / SUPERGRANULE_LIFETIME_S) % CLOCK_WRAP,
      );
      CONVECTION_OCTAVES.forEach((o, k) => {
        motionUniforms.uCellOctave.value[k]!.z =
          ((t / o.turnoverS) * CELL_SWELL_PER_LIFE) % CLOCK_WRAP;
      });
      motionUniforms.uTurn.value = frame.surfaceTurn;
      /* The photograph's own spots belong only to the Sun's own cycle. */
      activityUniforms.uMapUnclaimed.value = frame.photographed ? unclaimedSpotShare(t) : 0;
      motionUniforms.uEvershed.value = (t * EVERSHED_RADII_PER_S) % CLOCK_WRAP;
      motionUniforms.uSpiculeClock.value = (t / SPICULE_LIFETIME_S) % CLOCK_WRAP;
      activityUniforms.uDipole.value = frame.dipole;
      activityUniforms.uDipoleMoment.value.fromArray(frame.dipoleMoment);
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
        // Observed region IDs exceed twenty million. Sending them straight to a
        // float shader erases subpixel offsets and collapses noise into spokes.
        // Hash on the CPU, keeping the stable noise coordinate small.
        regionState[k]!.set(flare, region.facula, gap, 64 * dice(region.id, 173));
        photoDrawOf(region, t, draw);
        const donor = draw.donor;
        directionOf(donor.lat, donor.lon, dir);
        donorCentre.set(dir[0], dir[1], dir[2]);
        regionDonor[k]!.set(dir[0], dir[1], dir[2], donor.reach);
        /* The donor's axis as its region's is drawn, at the epoch (Joy's tilt of a seeded
           group), turned about its centre by the patch's turn. */
        tiltedAxis(donor.lat, donor.lon, JOY_SLOPE * Math.abs(donor.lat), dir);
        axis.set(dir[0], dir[1], dir[2]);
        side.crossVectors(donorCentre, axis);
        axis.multiplyScalar(Math.cos(draw.turn)).addScaledVector(side, Math.sin(draw.turn));
        regionDonorAxis[k]!.set(axis.x, axis.y, axis.z, draw.scale);
        regionPhoto[k] = draw.growth;
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
