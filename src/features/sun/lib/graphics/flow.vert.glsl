// Passive plasma tracers, distinct from magnetic field lines; positions come from the model.
attribute vec3 aPosition;
uniform float uHalfWidth;
varying vec2 vDisc;
varying vec3 vWorld;
void main() {
  vec4 p = modelViewMatrix * vec4(aPosition, 1.0);
  vDisc = position.xy;
  vWorld = (modelMatrix * vec4(aPosition, 1.0)).xyz;
  p.xy += position.xy * uHalfWidth * max(-p.z, 1e-4) * 0.75;
  gl_Position = projectionMatrix * p;
}
