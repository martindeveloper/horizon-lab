// Spacecraft vertex shader. The close pass puts the camera at the origin and the craft a few
// metres off, so world positions stay small and exact; normals go through the normal matrix,
// since the built models' quantised meshes carry their scale on the nodes.

varying vec3 vNormal; // world
varying vec3 vView;   // world, toward the camera
varying vec2 vUv;

#include <horizon/log-depth>

void main() {
  vUv = uv;
  vec4 eye = modelViewMatrix * vec4(position, 1.0);
  // View space back to world space: the view rotation's inverse is its transpose.
  vNormal = normalize((vec4(normalMatrix * normal, 0.0) * viewMatrix).xyz);
  vView = (vec4(-eye.xyz, 0.0) * viewMatrix).xyz;
  gl_Position = projectionMatrix * eye;
  logDepthVertex();
}
