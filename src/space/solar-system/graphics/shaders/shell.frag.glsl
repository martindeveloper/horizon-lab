// Oort-cloud guide shell: a translucent sphere that only shows at its rim,
// so it reads as a boundary rather than a solid ball.

uniform vec3 color;
uniform float opacity;

varying vec3 vNormal;
varying vec3 vWorld;

void main() {
  vec3 n = normalize(vNormal);
  vec3 viewDir = normalize(cameraPosition - vWorld);

  float fresnel = pow(1.0 - abs(dot(n, viewDir)), 1.85);

  gl_FragColor = vec4(color, fresnel * opacity);
}
