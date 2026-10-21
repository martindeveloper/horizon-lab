// Surface vertex shader shared by the planets, the Sun and the rings.
// Passes world-space position and normal so fragments can light themselves
// from the Sun at the origin, plus the texture coordinate. The normal goes
// through the normal matrix, so oblate (non-uniformly scaled) globes shade right.
//
// A close-up puts the camera a few planet radii from a body tens of au out,
// where float32 world positions are coarser than the body. So the clip
// position, the view direction and the offset from the body's centre all come
// from camera- or object-relative terms; the world position only aims at the Sun.

varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vView;   // world-space direction toward the camera
varying vec3 vOffset; // world-space offset from the object's origin (the body's centre)
varying vec2 vUv;

#include <horizon/log-depth>

void main() {
  vUv = uv;

  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  vOffset = mat3(modelMatrix) * position;
  vec4 eye = modelViewMatrix * vec4(position, 1.0);
  // View space back to world space: the view rotation's inverse is its transpose.
  vNormal = normalize((vec4(normalMatrix * normal, 0.0) * viewMatrix).xyz);
  vView = normalize((vec4(-eye.xyz, 0.0) * viewMatrix).xyz);

  gl_Position = projectionMatrix * eye;
  logDepthVertex();
}
