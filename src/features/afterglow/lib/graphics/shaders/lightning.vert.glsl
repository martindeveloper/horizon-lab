// Lightning's layer: the globe's own sphere at the cloud tops, the point in the globe's frame
// (where the storms stand) and the clip position from the camera-relative model-view matrix,
// as the globe's is.
varying vec3 vObject;

void main() {
  vObject = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
