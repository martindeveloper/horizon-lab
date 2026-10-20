// Lens finishing for a shader that resolves a frame onto the canvas (the rendering module's
// composite, or a feature's own resolve): the including shader declares the frame as
// `uniform sampler2D uImage` with one pixel `uniform vec2 uTexel`, and calls lensFringe on
// the colour it read at uv, then lensSpikes.
//
// lensFringe is a mild chromatic aberration: the red is read a little further out from the
// centre and the blue a little further in, by nothing at the centre and uFringe pixels at
// the corners, growing with the square of the distance, as a simple lens's colour error does.
// The reads blend in by the same measure, so the centre keeps the colour it was given
// (anti-aliased, say) exactly.
//
// lensSpikes adds the diffraction spikes the lens pass drew (uSpikes, at a lower
// resolution, read bilinearly) uSpikeStrength times, in the frame's own units: display
// values for a display frame, radiance for a floating-point one, before its display
// pipeline.

uniform sampler2D uSpikes;
uniform float uSpikeStrength;
uniform float uFringe;

vec3 lensFringe(vec3 centre, vec2 uv) {
  vec2 d = uv * 2.0 - 1.0;
  float f = 0.5 * dot(d, d);
  vec2 shift = (0.5 * uFringe * length(d)) * d * uTexel;
  float r = texture2D(uImage, uv + shift).r;
  float b = texture2D(uImage, uv - shift).b;
  return vec3(mix(centre.r, r, f), centre.g, mix(centre.b, b, f));
}

vec3 lensSpikes(vec3 colour, vec2 uv) {
  return colour + uSpikeStrength * texture2D(uSpikes, uv).rgb;
}
