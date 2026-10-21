import { glslHeader } from "@horizon/toolkit/shaders/defines";

import { SHADER_DEFINES } from "../src/features/black-hole/lib/parameters.ts";
import { SHADER_DEFINES as GIANTS_SHADER_DEFINES } from "../src/features/giants/lib/parameters.ts";
import { ORRERY_SHADER_DEFINES } from "../src/features/orrery/lib/graphics/shader-defines.ts";
import { SOLAR_SHADER_DEFINES } from "../src/space/solar-system/graphics/shader-defines.ts";

const command = "npm run shaders:generate";

/** Each lab's generated GLSL header: where it lives, and what it must contain. */
export const SHADER_HEADERS = [
  {
    lab: "black-hole",
    path: "src/features/black-hole/lib/parameters.generated.glsl",
    shaders: ["src/features/black-hole/lib/black-hole.frag.glsl"],
    defines: SHADER_DEFINES,
    guard: "HORIZON_BLACK_HOLE_PARAMETERS",
    source: "src/features/black-hole/lib/parameters.ts",
  },
  {
    lab: "giants",
    path: "src/features/giants/lib/graphics/parameters.generated.glsl",
    shaders: "src/features/giants/lib/graphics/",
    defines: GIANTS_SHADER_DEFINES,
    guard: "HORIZON_GIANTS_PARAMETERS",
    source: "src/features/giants/lib/parameters.ts",
  },
  {
    lab: "orrery",
    path: "src/features/orrery/lib/graphics/shaders/parameters.generated.glsl",
    shaders: "src/features/orrery/lib/graphics/shaders/",
    defines: ORRERY_SHADER_DEFINES,
    guard: "HORIZON_ORRERY_PARAMETERS",
    source: "src/features/orrery/lib/graphics/shader-defines.ts",
  },
  {
    lab: "solar-system",
    path: "src/space/solar-system/graphics/shaders/parameters.generated.glsl",
    shaders: "src/space/solar-system/graphics/shaders/",
    defines: SOLAR_SHADER_DEFINES,
    guard: "HORIZON_SOLAR_SYSTEM_PARAMETERS",
    source: "src/space/solar-system/graphics/shader-defines.ts",
  },
].map((header) => ({
  ...header,
  contents: glslHeader(header.defines, { guard: header.guard, source: header.source, command }),
}));
