// The range a full-screen pass's canvas shows, as the two uniforms createFullscreenPass sets:
// uGamut takes linear sRGB to the canvas's primaries (the identity on an sRGB canvas), and
// uDisplayPeak is the brightest light the canvas shows, in units of SDR white (1 on an SDR
// canvas). A display step brings its radiance in with `toPeak`, which leaves it in units of
// the peak, so a tone curve that ends at 1 ends at the peak; `fromPeak` takes the curve's
// result back to units of SDR white for `displayEncode` (<horizon/display>). Light the curve
// keeps linear keeps its value at any peak, and at a peak of 1 both are exact identities.

uniform mat3 uGamut;
uniform float uDisplayPeak;

vec3 toPeak(vec3 radiance) {
  return uGamut * radiance / uDisplayPeak;
}

vec3 fromPeak(vec3 toned) {
  return toned * uDisplayPeak;
}
