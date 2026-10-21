// The apex glow: a quad facing the camera, placed by the layer far out dead ahead, so any
// world in front of it hides it.

varying vec2 vUv;

#include <horizon/log-depth>

void main() {
  vUv = uv * 2.0 - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  logDepthVertex();
}
