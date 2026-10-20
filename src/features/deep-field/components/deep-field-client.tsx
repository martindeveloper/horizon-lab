"use client";

import { simulationClient } from "@/components/simulations/webgl-gate";

export const DeepFieldClient = simulationClient("deepField", () =>
  import("./deep-field").then((module) => module.DeepField),
);
