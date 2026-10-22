uniform mat4 inverseProjection;
uniform mat3 viewToHalo;
varying vec3 haloRay;
void main() {
  // A point in front of the eye; its direction is independent of clip-plane depth.
  vec3 viewRay = (inverseProjection * vec4(position.xy, 0.0, 1.0)).xyz;
  haloRay = viewToHalo * viewRay;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
