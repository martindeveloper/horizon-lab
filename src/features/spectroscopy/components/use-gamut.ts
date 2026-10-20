"use client";

import { useSyncExternalStore } from "react";

import type { Gamut } from "@horizon/toolkit/science";

import { WIDE_GAMUT_QUERY, canvasShowsP3, drawingGamut } from "../lib/quality";
import { useSpectroscopy } from "../lib/store";

const subscribe = (change: () => void) => {
  const query = window.matchMedia(WIDE_GAMUT_QUERY);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
};

/** Whether this screen and browser can draw Display P3: wide colour is offered only then. */
export function useWideGamut() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE_GAMUT_QUERY).matches && canvasShowsP3(),
    () => false,
  );
}

/** The gamut Spectra's canvases and spectral colours are drawn in. */
export function useDrawingGamut(): Gamut {
  const wide = useSpectroscopy((s) => s.wideColour);
  return drawingGamut(wide, useWideGamut());
}
