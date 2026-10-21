// oxlint-disable-next-line typescript/triple-slash-reference -- Source-package consumers need the ambient GLSL declaration without a runtime import.
/// <reference path="./glsl.d.ts" />
export { assembleShader } from "./assemble";
export {
  glslDefines,
  glslFloat,
  glslHeader,
  glslInt,
  type GlslDefines,
  type GlslHeaderOptions,
  type GlslInt,
  type GlslValue,
} from "./defines";
export { default as fullscreenVertex } from "./fullscreen.vert.glsl";
export { default as logDepthGLSL } from "./log-depth.glsl";
export { default as mathGLSL } from "./math.glsl";
export { default as noiseGLSL } from "./noise.glsl";
export { default as relativityGLSL } from "./relativity.glsl";
export { default as temperatureGLSL } from "./temperature.glsl";
export { default as starsGLSL } from "./stars.glsl";
export { default as tonemapGLSL } from "./tonemap.glsl";
