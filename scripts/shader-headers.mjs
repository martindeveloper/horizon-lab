import { glslHeader } from "@horizon/toolkit/shaders/defines";

import { SHADER_DEFINES } from "../src/features/black-hole/lib/parameters.ts";
import { ORRERY_SHADER_DEFINES } from "../src/features/orrery/lib/graphics/shader-defines.ts";

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
    lab: "orrery",
    path: "src/features/orrery/lib/graphics/shaders/parameters.generated.glsl",
    shaders: "src/features/orrery/lib/graphics/shaders/",
    defines: ORRERY_SHADER_DEFINES,
    guard: "HORIZON_ORRERY_PARAMETERS",
    source: "src/features/orrery/lib/graphics/shader-defines.ts",
  },
].map((header) => ({
  ...header,
  contents: glslHeader(header.defines, { guard: header.guard, source: header.source, command }),
}));
