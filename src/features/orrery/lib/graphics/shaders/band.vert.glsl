// Milky Way band: the sphere is centred on the camera, so the object-space
// position is the view direction the fragment shader needs.

varying vec3 vDir;

void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
