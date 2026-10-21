// The microwave background's shell about the ship: a sphere drawn from inside; each fragment
// is a direction on the sky.

varying vec3 vDirection;

void main() {
  vDirection = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
