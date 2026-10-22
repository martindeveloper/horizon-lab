import { glslDefines, glslInt } from "@horizon/toolkit/shaders/defines";

import { SPECTRUM_MAX_K, SPECTRUM_MIN_K, SPECTRUM_SAMPLES, SURFACE_RESOLVE_PX } from "./parameters";
import {
  SUN_ACTIVITY_DEPTH_RATIO,
  SUN_ACTIVITY_EXTINCTION,
  SUN_ACTIVITY_FILAMENT_RGB,
  SUN_ACTIVITY_KNOT_RGB,
  SUN_ACTIVITY_LIFT_WIDENING,
  SUN_ACTIVITY_MAX_REGIONS,
  SUN_ACTIVITY_MAX_STEPS,
  SUN_ACTIVITY_SINK,
  SUN_ACTIVITY_STREAM_RATIO,
  SUN_ACTIVITY_THREAD_RGB,
} from "./prominence/parameters";

/**
 * The shared Sun shaders' compile-time constants (the continuum table's sampling, the
 * prominence volume), written to `shaders/parameters.generated.glsl` by `npm run
 * shaders:generate` and included by the snippets Giants, the Orrery and the Sun lab share.
 */
export const SUN_SHARED_SHADER_DEFINES = glslDefines({
  SPECTRUM_MIN_K,
  SPECTRUM_MAX_K,
  SPECTRUM_SAMPLES: glslInt(SPECTRUM_SAMPLES),
  SURFACE_RESOLVE_PX,
  SUN_ACTIVITY_DEPTH_RATIO,
  SUN_ACTIVITY_SINK,
  SUN_ACTIVITY_LIFT_WIDENING,
  SUN_ACTIVITY_MAX_REGIONS: glslInt(SUN_ACTIVITY_MAX_REGIONS),
  SUN_ACTIVITY_MAX_STEPS: glslInt(SUN_ACTIVITY_MAX_STEPS),
  SUN_ACTIVITY_EXTINCTION,
  SUN_ACTIVITY_STREAM_RATIO,
  SUN_ACTIVITY_THREAD_RGB,
  SUN_ACTIVITY_KNOT_RGB,
  SUN_ACTIVITY_FILAMENT_RGB,
});
