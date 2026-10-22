uniform float opacity;
uniform float scaleRatio;
uniform vec3 cameraLocal;
varying vec3 haloRay;
void main() {
  vec3 ray = normalize(haloRay);
  float b = dot(cameraLocal, ray);
  float disc = b*b - dot(cameraLocal, cameraLocal) + 1.0;
  if (disc <= 0.0) discard;
  float nearT = max(0.0, -b - sqrt(disc));
  float farT = -b + sqrt(disc);
  if (farT <= nearT) discard;
  float stepT = (farT - nearT) / 64.0;
  float column = 0.0;
  for (int i = 0; i < 64; i++) {
    vec3 p = cameraLocal + ray * (nearT + (float(i) + 0.5) * stepT);
    float r = length(p);
    float x = max(r * scaleRatio, 0.025);
    column += stepT * scaleRatio / (x * (1.0+x) * (1.0+x))
      * (1.0 - smoothstep(0.8, 1.0, r));
  }
  float alpha = opacity * (1.0 - exp(-2.0 * sqrt(column)));
  gl_FragColor = vec4(0.48, 0.66, 0.76, alpha);
}
