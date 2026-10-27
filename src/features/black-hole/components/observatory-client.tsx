"use client";

import { simulationClient } from "@/components/simulations/webgl-gate";

export const ObservatoryClient = simulationClient("blackHole", () =>
  import("./observatory").then((module) => module.Observatory),
);
