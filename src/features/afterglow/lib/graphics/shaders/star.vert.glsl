// The Sun's globe: the surface point in its own frame (for the granulation), its normal and
// the way to the camera, both in world space; the clip position from the camera-relative
// model-view matrix, as the planets' is.
varying vec3 vPoint;
varying vec3 vNormal;
varying vec3 vView;

void main() {
  vPoint = position;
  vec4 eye = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize((vec4(normalMatrix * normal, 0.0) * viewMatrix).xyz);
  vView = normalize((vec4(-eye.xyz, 0.0) * viewMatrix).xyz);
  gl_Position = projectionMatrix * eye;
}
