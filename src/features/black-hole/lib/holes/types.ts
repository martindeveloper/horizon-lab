import type { OrbitFlight } from "@horizon/toolkit/camera";

import type { Sketch } from "../sketches";

export type HoleKind = "catalog" | "theory";

export type SkyId = "lensed" | "sgr" | "m87" | "cyg" | "lab" | "host";

export const SKY_CODE: Record<SkyId, number> = {
  lensed: 0,
  sgr: 1,
  m87: 2,
  cyg: 3,
  lab: 4,
  host: 5,
};

/**
 * One guide shot. yaw, inclination, distance, lift, swing and lead shape the
 * flight (see `sampleOrbitFlight`); roll is a Dutch tilt held on arrival;
 * drift (rad/s) and creep (fraction of distance) keep the camera moving
 * slowly while the card is read. sketch draws over the hole once it lands.
 */
export type TourPose = OrbitFlight & {
  duration: number;
  roll?: number;
  drift?: number;
  creep?: number;
  sketch?: Sketch[];
  eq?: string;
};

export type Preset = {
  id: string;
  name: string;
  kind: HoleKind;
  catalog: string;
  blurb: string;
  massSolar: number;
  /** The mass is only a lower limit (shown with ≥). */
  massLowerLimit?: boolean;
  spin: number;
  inclination: number;
  distance: number;
  exposure: number;
  diskBrightness: number;
  starIntensity: number;
  tempScale: number;
};

export type HoleSpec = Preset & {
  sky: SkyId;
  jet: number;
  aliases: string[];
  tour: TourPose[];
};

export type Quality = "economy" | "standard" | "cinema";

export type BlackHoleParams = {
  presetId: string;
  massSolar: number;
  spin: number;
  inclination: number;
  distance: number;
  exposure: number;
  diskBrightness: number;
  starIntensity: number;
  tempScale: number;
  autoRotate: boolean;
  quality: Quality;
};

export function paramsFromPreset(
  preset: Preset,
  quality: Quality,
  autoRotate: boolean,
): BlackHoleParams {
  return {
    presetId: preset.id,
    massSolar: preset.massSolar,
    spin: preset.spin,
    inclination: preset.inclination,
    distance: preset.distance,
    exposure: preset.exposure,
    diskBrightness: preset.diskBrightness,
    starIntensity: preset.starIntensity,
    tempScale: preset.tempScale,
    autoRotate,
    quality,
  };
}
