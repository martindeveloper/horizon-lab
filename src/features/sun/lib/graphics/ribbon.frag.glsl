// A ribbon's light: a soft core inside a faint halo, coloured by polarity (gold out, blue in)
// in true colour and the magnetogram, by its plasma's temperature through the band otherwise;
// shown as much as the light shows the field; open lines fade past the source surface. Added
// to what is behind, depth-tested against the globe.
precision highp float;

#include "./sun-common.glsl"
#include <horizon/srgb>

uniform vec3 uPositive;
uniform vec3 uNegative;
uniform vec3 uMagPositive;
uniform vec3 uMagNegative;
uniform float uPresence;   // how much the field shows in this light
varying float vAcross;
varying vec4 vLine;
varying float vRadius;
varying float vFade;
varying float vAlong;
varying vec3 vWorld;
varying float vTaper;
varying float vTube;

void main() {
  /* Across the halo: the core's share of its width, a Gaussian; the halo a soft fall-off. */
  float coreShare = RIBBON_WIDTH_PX / RIBBON_HALO_PX;
  float x = abs(vAcross) / coreShare;
  float core = exp(-x * x * 2.0);
  float halo = (1.0 - abs(vAcross)) * (1.0 - abs(vAcross));
  float profile = RIBBON_CORE * core + RIBBON_HALO * halo;
  float open = vLine.y > 0.5 ? (1.0 - smoothstep(OPEN_FADE_FROM, OPEN_FADE_TO, vRadius)) * vTaper : 1.0;
  float a = profile * open * vFade * vLine.z * uPresence;
  /* An arcade's tubes glow; the magnetogram's lines are a soft overlay. */
  if (vTube > 1.0) a *= TUBE_GLOW;
  if (uLightMode == LIGHT_MAGNETOGRAM) a *= MAGNETOGRAM_LINE;
  if (a <= 0.002) discard;
  /* An eclipse's occulting disc hides whatever lies in front of the face too. */
  if (uLightMode == LIGHT_ECLIPSE && length(cross(normalize(vWorld - cameraPosition), cameraPosition)) < 1.0) discard;
  /* A line's plasma, through the band: coronal plasma by the corona's weight, flare plasma by
     the flare's; a cool line (a rope, a filament) by the chromosphere's, with the hot sheath
     round it, which glows the rope's brightest. */
  float lnK = log(max(vLine.w, 1.0));
  float flareShare = smoothstep(log(ACTIVE_K), log(FLARE_K), lnK);
  float cool = 1.0 - smoothstep(log(CHROMOSPHERE_K), log(TRANSITION_K), lnK);
  float hot = mix(uWeights.w * layerResponse(lnK, LAYER_CORONA), uFlareWeight * layerResponse(lnK, LAYER_FLARE), flareShare);
  float sheath = LINE_SHEATH * (uWeights.z * layerResponse(log(TRANSITION_K), LAYER_TRANSITION) + 0.5 * uWeights.w * layerResponse(log(CORONA_K), LAYER_CORONA));
  float lit = mix(hot, uWeights.y * layerResponse(lnK, LAYER_CHROMOSPHERE) + sheath, cool) * (1.0 + (ROPE_GLOW - 1.0) * cool * step(1.5, vTube));
  vec3 col = uLightMode == LIGHT_BAND
    ? rampAt(uBandScale * lit * a * RIBBON_BAND_GAIN)
    : (uLightMode == LIGHT_MAGNETOGRAM ? (vLine.x > 0.0 ? uMagPositive : uMagNegative) : (vLine.x > 0.0 ? uPositive : uNegative)) * a;
  gl_FragColor = vec4(encodeSrgb(uGamut * col), 1.0);
}
