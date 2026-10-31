"use client";

import { simulationClient } from "@/components/simulations/webgl-gate";

export const AfterglowClient = simulationClient("afterglow", () =>
  import("./afterglow").then((module) => module.Afterglow),
);
