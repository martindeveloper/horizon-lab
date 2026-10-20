import { glslDefines, glslInt } from "@horizon/toolkit/shaders/defines";

import {
  SUN_ACTIVITY_DEPTH_RATIO,
  SUN_ACTIVITY_EXTINCTION,
  SUN_ACTIVITY_FILAMENT_RGB,
  SUN_ACTIVITY_KNOT_RGB,
  SUN_ACTIVITY_LIFT_WIDENING,
  SUN_ACTIVITY_MAX_STEPS,
  SUN_ACTIVITY_REGION_COUNT,
  SUN_ACTIVITY_SINK,
  SUN_ACTIVITY_STREAM_RATIO,
  SUN_ACTIVITY_THREAD_RGB,
} from "../model/solar-activity";

/**
 * The Orrery's own shaders' compile-time constants: the Sun's illustrative activity. They are
 * written to `shaders/parameters.generated.glsl` (`npm run shaders:generate`), which the
 * shaders `#include`; the solar system's shaders have their own.
 */
export const ORRERY_SHADER_DEFINES = glslDefines({
  SUN_ACTIVITY_DEPTH_RATIO,
  SUN_ACTIVITY_SINK,
  SUN_ACTIVITY_LIFT_WIDENING,
  SUN_ACTIVITY_REGION_COUNT: glslInt(SUN_ACTIVITY_REGION_COUNT),
  SUN_ACTIVITY_MAX_STEPS: glslInt(SUN_ACTIVITY_MAX_STEPS),
  SUN_ACTIVITY_EXTINCTION,
  SUN_ACTIVITY_STREAM_RATIO,
  SUN_ACTIVITY_THREAD_RGB,
  SUN_ACTIVITY_KNOT_RGB,
  SUN_ACTIVITY_FILAMENT_RGB,
});
