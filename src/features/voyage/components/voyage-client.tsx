"use client";

import { simulationClient } from "@/components/simulations/webgl-gate";

export const VoyageClient = simulationClient("voyage", () =>
  import("./voyage").then((module) => module.Voyage),
);
