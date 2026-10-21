// The last step of a shader that owns its display pipeline and writes straight to a canvas
// (a renderer whose output colour space leaves the colour as written): `displayEncode` applies
// the sRGB transfer curve (`<horizon/srgb>`), which Display P3 canvases share, to linear light
// already in the canvas's primaries, with a dither of about one 8-bit step, so slow gradients
// show no bands.

#include <horizon/noise>
#include <horizon/srgb>

vec3 displayEncode(vec3 linear) {
  return encodeSrgb(linear) + (hash21(gl_FragCoord.xy) - 0.5) / 255.0;
}
