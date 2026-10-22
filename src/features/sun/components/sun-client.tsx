"use client";

import { simulationClient } from "@/components/simulations/webgl-gate";

export const SunClient = simulationClient("sun", () =>
  import("./sun").then((module) => module.Sun),
);
