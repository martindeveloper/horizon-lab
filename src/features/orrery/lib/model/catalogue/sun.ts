/** The Sun over the timeline: its brightening on the main sequence (the habitable zone's edges are the shared Sun's, `@/space/sun/model/young-sun`). */
import type { Facts } from "@/lib/facts";
import { MODEL_START } from "@/space/solar-system/model/parameters";

import { sunLuminosity } from "../young-sun";

export const SUN = {
  sun: {
    start: {
      value: sunLuminosity(MODEL_START) * 100,
      unit: "percent",
      digits: 2,
      source: "gough1981",
      status: "derived",
      sources: ["feulner2012"],
      note: "of today's output as the sketch starts, from L(t) = L☉ / (1 + 0.4 (1 − t/t☉)); within a few per cent of standard models after the first ~0.2 Gyr",
    },
  },
} as const satisfies Record<string, Facts>;
