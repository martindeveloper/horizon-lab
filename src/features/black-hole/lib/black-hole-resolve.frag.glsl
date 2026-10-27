// Finishes a bloomed or lensed frame of the ray shader's radiance onto the canvas through the
// observatory's display pipeline (display.glsl), as <horizon/resolve> draws it. The pipeline's
// vignette and tone map read these uniforms.

uniform vec2 uResolution;
uniform float uExposure;
uniform float uVignette;

#include "./display.glsl"
#include <horizon/resolve>
