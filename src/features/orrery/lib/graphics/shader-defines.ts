import { glslDefines, glslInt } from "@horizon/toolkit/shaders/defines";

import {
  DUST_CAVITY_IN_AU,
  DUST_CAVITY_OUT_AU,
  GAS_DISK_RADIUS_AU,
  GAS_RIM_FRACTION,
  PLANET_WRAP,
  RING_AMBIENT,
  SUN_CENTRE_RGB,
  SUN_MAP_QUIET_INTENSITY,
  SUN_LIMB_U,
  SUN_LIMB_V,
  SWARM_KEPLER_STEPS,
  TROJAN_OFFSET_DEG,
} from "../model/parameters";

/**
 * The orrery shaders' compile-time constants, from `parameters.ts`. They are
 * written to `shaders/parameters.generated.glsl` (`npm run shaders:generate`),
 * which the shaders `#include`; names carry their shader's prefix.
 */
export const ORRERY_SHADER_DEFINES = glslDefines({
  SWARM_TROJAN_OFFSET: (TROJAN_OFFSET_DEG * Math.PI) / 180,
  SWARM_KEPLER_STEPS: glslInt(SWARM_KEPLER_STEPS),
  GAS_CAVITY_IN: DUST_CAVITY_IN_AU / GAS_DISK_RADIUS_AU,
  GAS_CAVITY_OUT: DUST_CAVITY_OUT_AU / GAS_DISK_RADIUS_AU,
  GAS_RIM_IN: GAS_RIM_FRACTION,
  GAS_RIM_OUT: 1,
  SUN_CENTRE_RGB,
  SUN_MAP_QUIET_INTENSITY,
  SUN_LIMB_U,
  SUN_LIMB_V,
  PLANET_WRAP,
  RING_AMBIENT,
});
