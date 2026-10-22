varying vec3 skyDirection;
void main() {
  skyDirection = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
