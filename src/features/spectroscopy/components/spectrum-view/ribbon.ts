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

/** Paints the ribbon: each pixel the hue of its wavelength at the brightness of its light. */
function paintRibbon(canvas: HTMLCanvasElement, spectrum: Spectrum, gamut: Gamut) {
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
  for (let i = 0; i < n; i++) {
    const nm = spectrum.wavelengths[i]!;
    const [r, g, b] = hueAt(nm, hues);
    const level = Math.sqrt(Math.max(0, spectrum.flux[i]! / top)) * edgeFade(nm);
    image.data[i * 4] = r * level * 255;
    image.data[i * 4 + 1] = g * level * 255;
    image.data[i * 4 + 2] = b * level * 255;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

/** Keeps the ribbon canvas painted for the spectrum in view. */
export function useRibbon(
  ribbon: RefObject<HTMLCanvasElement | null>,
  spectrum: Spectrum | null,
  gamut: Gamut,
) {
  useEffect(() => {
    const canvas = ribbon.current;
    if (!canvas || !spectrum) return;
    paintRibbon(canvas, spectrum, gamut);
  }, [ribbon, spectrum, gamut]);
}
