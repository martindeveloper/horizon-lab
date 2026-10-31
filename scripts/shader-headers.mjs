import { glslHeader } from "@horizon/toolkit/shaders/defines";

import { SHADER_DEFINES as AFTERGLOW_SHADER_DEFINES } from "../src/features/afterglow/lib/model/parameters.ts";
import { SHADER_DEFINES } from "../src/features/black-hole/lib/parameters.ts";
import { SHADER_DEFINES as GIANTS_SHADER_DEFINES } from "../src/features/giants/lib/parameters.ts";
import { SHADER_DEFINES as SUN_SHADER_DEFINES } from "../src/features/sun/lib/parameters.ts";
import { SOLAR_SHADER_DEFINES } from "../src/space/solar-system/graphics/shader-defines.ts";
import { SPACECRAFT_SHADER_DEFINES } from "../src/space/spacecraft/graphics/shader-defines.ts";
import { SUN_SHARED_SHADER_DEFINES } from "../src/space/sun/graphics/shader-defines.ts";

const command = "npm run shaders:generate";

/** Each lab's generated GLSL header: where it lives, and what it must contain. */
export const SHADER_HEADERS = [
  {
    lab: "afterglow",
    path: "src/features/afterglow/lib/graphics/shaders/parameters.generated.glsl",
    shaders: "src/features/afterglow/lib/graphics/shaders/",
    defines: AFTERGLOW_SHADER_DEFINES,
    guard: "HORIZON_AFTERGLOW_PARAMETERS",
    source: "src/features/afterglow/lib/model/parameters.ts",
  },
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
    lab: "sun",
    path: "src/features/sun/lib/graphics/parameters.generated.glsl",
    shaders: "src/features/sun/lib/graphics/",
    defines: SUN_SHADER_DEFINES,
    guard: "HORIZON_SUN_PARAMETERS",
    source: "src/features/sun/lib/parameters.ts",
  },
  {
    lab: "solar-system",
    path: "src/space/solar-system/graphics/shaders/parameters.generated.glsl",
    shaders: "src/space/solar-system/graphics/shaders/",
    defines: SOLAR_SHADER_DEFINES,
    guard: "HORIZON_SOLAR_SYSTEM_PARAMETERS",
    source: "src/space/solar-system/graphics/shader-defines.ts",
  },
  {
    lab: "sun-shared",
    path: "src/space/sun/graphics/shaders/parameters.generated.glsl",
    shaders: "src/space/sun/graphics/",
    defines: SUN_SHARED_SHADER_DEFINES,
    guard: "HORIZON_SUN_SHARED_PARAMETERS",
    source: "src/space/sun/graphics/shader-defines.ts",
  },
  {
    lab: "spacecraft",
    path: "src/space/spacecraft/graphics/shaders/parameters.generated.glsl",
    shaders: "src/space/spacecraft/graphics/shaders/",
    defines: SPACECRAFT_SHADER_DEFINES,
    guard: "HORIZON_SPACECRAFT_PARAMETERS",
    source: "src/space/spacecraft/graphics/shader-defines.ts",
  },
].map((header) => ({
  ...header,
  contents: glslHeader(header.defines, { guard: header.guard, source: header.source, command }),
}));
