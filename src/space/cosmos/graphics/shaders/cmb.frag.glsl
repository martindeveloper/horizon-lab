uniform sampler2D planckMap;
uniform sampler2D actMap;
uniform bool planckReady;
uniform bool actReady;
uniform float opacity;
uniform float temperatureScale;
uniform float temperatureOffset;
uniform float colourLimit;
uniform vec3 coolColour;
uniform vec3 neutralColour;
uniform vec3 warmColour;
varying vec3 skyDirection;
void main() {
  vec3 n = normalize(skyDirection);
  // Galactic north is +y; l=0 points along -x, l=90 along +z.
  vec2 uv = vec2(fract(atan(n.z, -n.x) / 6.28318530718 + 1.0),
                 0.5 - asin(clamp(n.y, -1.0, 1.0)) / 3.14159265359);
  vec4 p = texture2D(planckMap, uv);
  vec4 a = texture2D(actMap, uv);
  bool validP = planckReady && p.b > 0.9999;
  bool validA = actReady && a.b > 0.9999;
  // Empty sky remains a neutral mask. Interpolation across masks is rejected.
  if (!validA && !validP) {
    gl_FragColor = vec4(neutralColour * 0.12, opacity * 0.16);
    return;
  }
  vec2 packedValue = validA ? a.rg : p.rg;
  float temperature = (dot(packedValue * 255.0, vec2(256.0, 1.0)) - temperatureOffset) * temperatureScale;
  float t = clamp(temperature / colourLimit, -1.0, 1.0);
  vec3 colour = mix(neutralColour, t < 0.0 ? coolColour : warmColour, abs(t));
  gl_FragColor = vec4(colour, opacity);
}
