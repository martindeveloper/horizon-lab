// Selection reticle: a quad that always faces the camera, centred on the
// selected body. `size` is its half-width in world units, kept to a constant
// number of screen pixels by the caller.

uniform float size;

varying vec2 vUv;

void main() {
  vUv = position.xy;
  vec4 centre = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  centre.xy += position.xy * size;
  gl_Position = projectionMatrix * centre;
}
