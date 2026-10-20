"use client";

import { simulationClient } from "@/components/simulations/webgl-gate";

export const OrreryClient = simulationClient("orrery", () =>
  import("./orrery").then((module) => module.Orrery),
);
