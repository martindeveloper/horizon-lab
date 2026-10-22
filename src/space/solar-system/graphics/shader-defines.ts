import { glslDefines, glslInt } from "@horizon/toolkit/shaders/defines";

import {
  DUST_CAVITY_IN_AU,
  DUST_CAVITY_OUT_AU,
  GAS_DISK_RADIUS_AU,
  GAS_RIM_FRACTION,
  PLANET_WRAP,
  RING_AMBIENT,
  RING_DUST_HG_G,
  RING_DUST_HG_W,
  SUN_CENTRE_RGB,
  SUN_LIMB_CHROMA,
  SUN_LIMB_U,
  SUN_LIMB_V,
  SUN_MAP_QUIET_INTENSITY,
  SWARM_KEPLER_STEPS,
  TRACER_KEPLER_STEPS,
  TRACER_PUMP,
  TROJAN_OFFSET_DEG,
} from "../model/parameters";
import { BINS } from "../model/tracers";

/**
 * Preserve linear-sRGB luminance while softening narrow-band chromatic contrast.
 * Bake this display transform into the coefficients, adding no fragment-shader work.
 */
function displayLimb([r, g, b]: readonly [number, number, number]) {
  const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
  return [r, g, b].map((channel) => luminance + (channel - luminance) * SUN_LIMB_CHROMA);
}

/**
 * The solar system shaders' compile-time constants, from `parameters.ts`. They are
 * written to `shaders/parameters.generated.glsl` (`npm run shaders:generate`),
 * which the shaders `#include`; names carry their shader's prefix.
 */
export const SOLAR_SHADER_DEFINES = glslDefines({
  SWARM_TROJAN_OFFSET: (TROJAN_OFFSET_DEG * Math.PI) / 180,
  SWARM_KEPLER_STEPS: glslInt(SWARM_KEPLER_STEPS),
  TRACER_KEPLER_STEPS: glslInt(TRACER_KEPLER_STEPS),
  TRACER_BINS: glslInt(BINS.length),
  TRACER_PUMP_PERIHELION: TRACER_PUMP.perihelionAu,
  TRACER_PUMP_FLOOR: TRACER_PUMP.floorAu,
  TRACER_PUMP_MAX_E: TRACER_PUMP.maxE,
  TRACER_PUMP_PEAK: TRACER_PUMP.peakS,
  GAS_CAVITY_IN: DUST_CAVITY_IN_AU / GAS_DISK_RADIUS_AU,
  GAS_CAVITY_OUT: DUST_CAVITY_OUT_AU / GAS_DISK_RADIUS_AU,
  GAS_RIM_IN: GAS_RIM_FRACTION,
  GAS_RIM_OUT: 1,
  SUN_CENTRE_RGB,
  SUN_MAP_QUIET_INTENSITY,
  SUN_DISPLAY_LIMB_U: displayLimb(SUN_LIMB_U),
  SUN_DISPLAY_LIMB_V: displayLimb(SUN_LIMB_V),
  PLANET_WRAP,
  RING_AMBIENT,
  RING_DUST_HG_G,
  RING_DUST_HG_W,
});
