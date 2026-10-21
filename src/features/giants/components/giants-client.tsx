"use client";

import { simulationClient } from "@/components/simulations/webgl-gate";

export const GiantsClient = simulationClient("giants", () =>
  import("./giants").then((module) => module.Giants),
);
