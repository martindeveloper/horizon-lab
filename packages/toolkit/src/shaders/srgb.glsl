// The sRGB transfer curve (IEC 61966-2-1), which Display P3 shares: `encodeSrgb` takes linear
// light to the encoded value a canvas shows, `decodeSrgb` back. The same as `encodeSrgb` and
// `decodeSrgb` in science/color.ts.

vec3 encodeSrgb(vec3 linear) {
  vec3 c = max(linear, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec3 decodeSrgb(vec3 encoded) {
  vec3 c = max(encoded, vec3(0.0));
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
