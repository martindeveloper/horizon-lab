import { planckRadiance } from "./spectra";

/**
 * The colour of light as a screen can show it: the CIE 1931 standard observer turns a spectrum
 * into XYZ, the sRGB primaries (IEC 61966-2-1, D65 white) into pixels. A screen cannot show a
 * single wavelength's full saturation: primaries it would need below zero are clipped.
 */

export type Xyz = readonly [X: number, Y: number, Z: number];
export type Rgb = readonly [r: number, g: number, b: number];

/**
 * The colour space a screen is drawn in: sRGB, or the wider Display P3 (same D65 white and
 * transfer curve, more saturated primaries), which shows spectral colours closer to the eye's.
 */
export type Gamut = "srgb" | "p3";

/**
 * The CIE 1931 2° standard observer's colour-matching functions x̄, ȳ, z̄ from 380 to 780 nm
 * in 5 nm steps (CIE 018:2019 dataset, four significant figures).
 */
const CMF_START = 380;
const CMF_STEP = 5;
const CMF: readonly Xyz[] = [
  [0.001368, 0.000039, 0.00645],
  [0.002236, 0.000064, 0.01055],
  [0.004243, 0.00012, 0.02005],
  [0.00765, 0.000217, 0.03621],
  [0.01431, 0.000396, 0.06785],
  [0.02319, 0.00064, 0.1102],
  [0.04351, 0.00121, 0.2074],
  [0.07763, 0.00218, 0.3713],
  [0.1344, 0.004, 0.6456],
  [0.2148, 0.0073, 1.039],
  [0.2839, 0.0116, 1.386],
  [0.3285, 0.01684, 1.623],
  [0.3483, 0.023, 1.747],
  [0.3481, 0.0298, 1.783],
  [0.3362, 0.038, 1.772],
  [0.3187, 0.048, 1.744],
  [0.2908, 0.06, 1.669],
  [0.2511, 0.0739, 1.528],
  [0.1954, 0.09098, 1.288],
  [0.1421, 0.1126, 1.042],
  [0.09564, 0.139, 0.813],
  [0.05795, 0.1693, 0.6162],
  [0.03201, 0.208, 0.4652],
  [0.0147, 0.2586, 0.3533],
  [0.0049, 0.323, 0.272],
  [0.0024, 0.4073, 0.2123],
  [0.0093, 0.503, 0.1582],
  [0.0291, 0.6082, 0.1117],
  [0.06327, 0.71, 0.07825],
  [0.1096, 0.7932, 0.05725],
  [0.1655, 0.862, 0.04216],
  [0.2257, 0.9149, 0.02984],
  [0.2904, 0.954, 0.0203],
  [0.3597, 0.9803, 0.0134],
  [0.4334, 0.995, 0.00875],
  [0.5121, 1, 0.00575],
  [0.5945, 0.995, 0.0039],
  [0.6784, 0.9786, 0.00275],
  [0.7621, 0.952, 0.0021],
  [0.8425, 0.9154, 0.0018],
  [0.9163, 0.87, 0.00165],
  [0.9786, 0.8163, 0.0014],
  [1.026, 0.757, 0.0011],
  [1.057, 0.6949, 0.001],
  [1.062, 0.631, 0.0008],
  [1.046, 0.5668, 0.0006],
  [1.003, 0.503, 0.00034],
  [0.9384, 0.4412, 0.00024],
  [0.8544, 0.381, 0.00019],
  [0.7514, 0.321, 0.0001],
  [0.6424, 0.265, 0.00005],
  [0.5419, 0.217, 0.00003],
  [0.4479, 0.175, 0.00002],
  [0.3608, 0.1382, 0.00001],
  [0.2835, 0.107, 0],
  [0.2187, 0.0816, 0],
  [0.1649, 0.061, 0],
  [0.1212, 0.04458, 0],
  [0.0874, 0.032, 0],
  [0.0636, 0.0232, 0],
  [0.04677, 0.017, 0],
  [0.0329, 0.01192, 0],
  [0.0227, 0.00821, 0],
  [0.01584, 0.005723, 0],
  [0.01136, 0.004102, 0],
  [0.008111, 0.002929, 0],
  [0.00579, 0.002091, 0],
  [0.004109, 0.001484, 0],
  [0.002899, 0.001047, 0],
  [0.002049, 0.00074, 0],
  [0.00144, 0.00052, 0],
  [0.0009999, 0.0003611, 0],
  [0.0006901, 0.0002492, 0],
  [0.000476, 0.0001719, 0],
  [0.0003323, 0.00012, 0],
  [0.0002348, 0.0000848, 0],
  [0.0001662, 0.00006, 0],
  [0.0001174, 0.0000424, 0],
  [0.00008308, 0.00003, 0],
  [0.00005871, 0.0000212, 0],
  [0.00004151, 0.00001499, 0],
];

/** The CIE 1931 2° colour-matching functions at a wavelength (nm), interpolated; zero outside 380–780 nm. */
export function cieObserver(nm: number): Xyz {
  const x = (nm - CMF_START) / CMF_STEP;
  if (!(x >= 0) || x > CMF.length - 1) return [0, 0, 0];
  const i = Math.min(CMF.length - 2, Math.floor(x));
  const t = x - i;
  const a = CMF[i]!;
  const b = CMF[i + 1]!;
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])];
}

/** XYZ of a spectral radiance sampled from `from` to `to` nm (the visible range by default). */
export function spectrumXyz(radiance: (nm: number) => number, from = 380, to = 780, step = 1): Xyz {
  let X = 0;
  let Y = 0;
  let Z = 0;
  for (let nm = from; nm <= to; nm += step) {
    const power = radiance(nm) * step;
    const [x, y, z] = cieObserver(nm);
    X += power * x;
    Y += power * y;
    Z += power * z;
  }
  return [X, Y, Z];
}

/** Chromaticity coordinates (x, y) of a colour. */
export function chromaticity([X, Y, Z]: Xyz) {
  const sum = X + Y + Z;
  return sum > 0 ? { x: X / sum, y: Y / sum } : { x: 1 / 3, y: 1 / 3 };
}

/** Linear sRGB from XYZ (IEC 61966-2-1); components fall outside 0–1 out of gamut. */
export function xyzToLinearSrgb([X, Y, Z]: Xyz): Rgb {
  return [
    3.2406 * X - 1.5372 * Y - 0.4986 * Z,
    -0.9689 * X + 1.8758 * Y + 0.0415 * Z,
    0.0557 * X - 0.204 * Y + 1.057 * Z,
  ];
}

/** Linear Display P3 from XYZ (D65); components fall outside 0–1 out of gamut. */
export function xyzToLinearP3([X, Y, Z]: Xyz): Rgb {
  return [
    2.4935 * X - 0.9314 * Y - 0.4027 * Z,
    -0.8295 * X + 1.7627 * Y + 0.0236 * Z,
    0.0358 * X - 0.0762 * Y + 0.9569 * Z,
  ];
}

/** The sRGB transfer curve (Display P3 shares it), linear light (0–1) to an encoded value (0–1). */
export function encodeSrgb(linear: number) {
  const v = Math.min(1, Math.max(0, linear));
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
}

/**
 * The colour at full brightness, sRGB-encoded: primaries the screen would need below zero
 * (it cannot subtract light) are clipped, then the brightest channel is scaled to 1.
 * Brightness is the caller's to apply.
 */
export function displayColor(xyz: Xyz, gamut: Gamut = "srgb"): Rgb {
  const [lr, lg, lb] = gamut === "p3" ? xyzToLinearP3(xyz) : xyzToLinearSrgb(xyz);
  const r = Math.max(0, lr);
  const g = Math.max(0, lg);
  const b = Math.max(0, lb);
  const top = Math.max(r, g, b);
  if (!(top > 0)) return [0, 0, 0];
  return [encodeSrgb(r / top), encodeSrgb(g / top), encodeSrgb(b / top)];
}

/** The colour of a black body at a temperature, as `displayColor` shows it. */
export function blackbodyColor(kelvin: number, gamut: Gamut = "srgb"): Rgb {
  return displayColor(
    spectrumXyz((nm) => planckRadiance(nm, kelvin), 380, 780, 5),
    gamut,
  );
}

/** The hue of one wavelength of light, as `displayColor` shows it. */
export const wavelengthColor = (nm: number, gamut: Gamut = "srgb"): Rgb =>
  displayColor(cieObserver(nm), gamut);

/** A CSS colour from encoded sRGB components (0–1), optionally scaled in brightness. */
export function cssRgb([r, g, b]: Rgb, brightness = 1) {
  const c = (v: number) => Math.round(Math.min(1, Math.max(0, v * brightness)) * 255);
  return `rgb(${c(r)} ${c(g)} ${c(b)})`;
}

/** A CSS colour from components encoded in `gamut` (0–1), with an opacity. */
export function cssColor([r, g, b]: Rgb, alpha = 1, gamut: Gamut = "srgb") {
  if (gamut === "p3") {
    const c = (v: number) => Math.min(1, Math.max(0, v)).toFixed(4);
    return `color(display-p3 ${c(r)} ${c(g)} ${c(b)} / ${alpha})`;
  }
  const c = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  return `rgb(${c(r)} ${c(g)} ${c(b)} / ${alpha})`;
}

/**
 * Black-body colours as a `size` × 1 RGBA texture, encoded sRGB at full brightness,
 * log-spaced in temperature from `minK` to `maxK` (texel i is minK (maxK/minK)^(i/(size−1))),
 * so a shader reads the colour of T at u = log(T/minK) / log(maxK/minK). Alpha is 255.
 */
export function blackbodyLut(size = 256, minK = 1000, maxK = 40_000, gamut: Gamut = "srgb") {
  if (!(size >= 2) || !(minK > 0) || !(maxK > minK))
    throw new RangeError("blackbodyLut needs size ≥ 2 and 0 < minK < maxK");
  const lut = new Uint8Array(size * 4);
  const ratio = Math.log(maxK / minK);
  for (let i = 0; i < size; i += 1) {
    const kelvin = minK * Math.exp((ratio * i) / (size - 1));
    const [r, g, b] = blackbodyColor(kelvin, gamut);
    lut[i * 4] = Math.round(r * 255);
    lut[i * 4 + 1] = Math.round(g * 255);
    lut[i * 4 + 2] = Math.round(b * 255);
    lut[i * 4 + 3] = 255;
  }
  return lut;
}

/** The texture coordinate (0–1) at which `blackbodyLut(size, minK, maxK)` holds a temperature. */
export function blackbodyLutCoordinate(kelvin: number, minK = 1000, maxK = 40_000) {
  const t = Math.log(kelvin / minK) / Math.log(maxK / minK);
  return Math.min(1, Math.max(0, t));
}
