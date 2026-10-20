"use client";

import { useWideGamutScreen } from "@/components/simulations/use-wide-gamut";
import type { Gamut } from "@horizon/toolkit/science";

import { canvasShowsP3, drawingGamut } from "../lib/quality";
import { useSpectroscopy } from "../lib/store";

/** Whether this screen and browser can draw Display P3 on a 2D canvas: wide colour is offered only then. */
function useWideGamut() {
  return useWideGamutScreen() && canvasShowsP3();
}

/** The gamut Spectra's canvases and spectral colours are drawn in. */
export function useDrawingGamut(): Gamut {
  const wide = useSpectroscopy((s) => s.wideColour);
  return drawingGamut(wide, useWideGamut());
}
