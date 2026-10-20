"use client";

import { simulationClient } from "@/components/simulations/webgl-gate";

/* The lab computes its spectra on 2D canvases: no WebGL check. */
export const SpectroscopyClient = simulationClient(
  "spectroscopy",
  () => import("./spectroscopy").then((module) => module.Spectroscopy),
  { gate: false },
);
