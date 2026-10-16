// Sky stars and Milky Way grains: one point per star with its own size.
// `color` is the built-in vertex colour attribute (vertexColors: true).

attribute float size; // pixels at device-pixel-ratio 1

uniform float dpr;  // device pixel ratio the material was made for
uniform float fade; // presence 0–1: real stars fade in the deep past

varying vec3 vColor;

void main() {
  vColor = color * fade;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * dpr * (0.6 + 0.4 * fade);
}
