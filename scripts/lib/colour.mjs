/** The sRGB transfer function, 8-bit display values to linear light, as a lookup. */
export const SRGB_TO_LINEAR = Float32Array.from({ length: 256 }, (_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

/** Linear light to an 8-bit sRGB display value, clamped to the range. */
export const encodeSrgb = (v) => {
  if (v <= 0) {
    return 0;
  }
  if (v >= 1) {
    return 255;
  }
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.round(c * 255);
};
