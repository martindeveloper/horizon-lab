import { useEffect, type RefObject } from "react";

import { lerp, smoothstep } from "@horizon/toolkit/math";
import { wavelengthColor, type Gamut, type Rgb } from "@horizon/toolkit/science";

import { FULL_RANGE } from "../../lib/model/scenes";
import type { Spectrum } from "../../lib/model/spectrum";
import { context2d } from "../../lib/quality";

/** Hues of each nanometre in each gamut, computed once: the ribbon's colours. */
const HUES = new Map<Gamut, readonly Rgb[]>();
function huesIn(gamut: Gamut) {
  let hues = HUES.get(gamut);
  if (!hues) {
    hues = Array.from({ length: FULL_RANGE[1] - FULL_RANGE[0] + 2 }, (_, i) =>
      wavelengthColor(FULL_RANGE[0] + i, gamut),
    );
    HUES.set(gamut, hues);
  }
  return hues;
}
function hueAt(nm: number, hues: readonly Rgb[]): readonly [number, number, number] {
  const x = Math.min(hues.length - 1.001, Math.max(0, nm - FULL_RANGE[0]));
  const i = Math.floor(x);
  const t = x - i;
  const a = hues[i]!;
  const b = hues[i + 1]!;
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** The eye barely sees the ends of the range: the ribbon fades there, as the tile's does. */
function edgeFade(nm: number) {
  const [lo, hi] = FULL_RANGE;
  return 0.35 + 0.65 * smoothstep(lo, lo + 50, nm) * smoothstep(hi, hi - 80, nm);
}

/** One box blur of `radius` pixels each way over `src`, three channels per pixel, into `dst`. */
function boxBlur(src: Float32Array, dst: Float32Array, n: number, radius: number) {
  const width = 2 * radius + 1;
  for (let c = 0; c < 3; c++) {
    let sum = 0;
    for (let i = -radius; i <= radius; i++) if (i >= 0 && i < n) sum += src[i * 3 + c]!;
    for (let i = 0; i < n; i++) {
      dst[i * 3 + c] = sum / width;
      const out = i - radius;
      const into = i + radius + 1;
      if (out >= 0) sum -= src[out * 3 + c]!;
      if (into < n) sum += src[into * 3 + c]!;
    }
  }
}

/**
 * The Glow switch's halo on the ribbon: the light of each strong emission line (its flux above
 * the continuum, over the brightest in view; in full from four tenths, nothing under a tenth)
 * spread about `radius` pixels each way in the line's own hue, three channels per pixel, 0..1,
 * to add to the ribbon. Absorption lines lie below the continuum and spread nothing, so they
 * stay crisp. Three box blurs, close to a Gaussian, cost the same whatever the radius.
 */
export function ribbonHalo(spectrum: Spectrum, radius: number, gamut: Gamut) {
  const n = spectrum.wavelengths.length;
  const half = Math.round(radius * 0.6);
  if (!(half >= 1) || n === 0) return null;
  const hues = huesIn(gamut);
  const top = spectrum.peak || 1;
  let source = new Float32Array(n * 3);
  let any = false;
  for (let i = 0; i < n; i++) {
    const excess = (spectrum.flux[i]! - spectrum.continuum[i]!) / top;
    const strength = excess * smoothstep(0.1, 0.4, excess) * edgeFade(spectrum.wavelengths[i]!);
    if (!(strength > 0)) continue;
    any = true;
    const [r, g, b] = hueAt(spectrum.wavelengths[i]!, hues);
    source[i * 3] = r * strength;
    source[i * 3 + 1] = g * strength;
    source[i * 3 + 2] = b * strength;
  }
  if (!any) return null;
  let blurred = new Float32Array(n * 3);
  for (let pass = 0; pass < 3; pass++) {
    boxBlur(source, blurred, n, half);
    [source, blurred] = [blurred, source];
  }
  return source;
}

/**
 * Paints the ribbon: each pixel the hue of its wavelength at the brightness of its light, and
 * with `halo` above 0 (pixels) the strong emission lines' soft halo over it.
 */
function paintRibbon(canvas: HTMLCanvasElement, spectrum: Spectrum, gamut: Gamut, halo: number) {
  const n = spectrum.wavelengths.length;
  canvas.width = n;
  canvas.height = 1;
  const ctx = context2d(canvas, gamut);
  if (!ctx) return;
  const image = ctx.createImageData(n, 1, {
    colorSpace: gamut === "p3" ? "display-p3" : "srgb",
  });
  const hues = huesIn(gamut);
  const top = spectrum.peak || 1;
  const soft = halo > 0 ? ribbonHalo(spectrum, halo, gamut) : null;
  for (let i = 0; i < n; i++) {
    const nm = spectrum.wavelengths[i]!;
    const [r, g, b] = hueAt(nm, hues);
    const level = Math.sqrt(Math.max(0, spectrum.flux[i]! / top)) * edgeFade(nm);
    let red = r * level;
    let green = g * level;
    let blue = b * level;
    if (soft) {
      red += HALO_STRENGTH * soft[i * 3]!;
      green += HALO_STRENGTH * soft[i * 3 + 1]!;
      blue += HALO_STRENGTH * soft[i * 3 + 2]!;
    }
    image.data[i * 4] = Math.min(255, red * 255);
    image.data[i * 4 + 1] = Math.min(255, green * 255);
    image.data[i * 4 + 2] = Math.min(255, blue * 255);
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

/** How much of the halo is added to the ribbon. */
const HALO_STRENGTH = 0.8;

/** Keeps the ribbon canvas painted for the spectrum in view; `halo` is the Glow switch's radius in ribbon pixels, 0 for none. */
export function useRibbon(
  ribbon: RefObject<HTMLCanvasElement | null>,
  spectrum: Spectrum | null,
  gamut: Gamut,
  halo: number,
) {
  useEffect(() => {
    const canvas = ribbon.current;
    if (!canvas || !spectrum) return;
    paintRibbon(canvas, spectrum, gamut, halo);
  }, [ribbon, spectrum, gamut, halo]);
}
