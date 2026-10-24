/** The Sun over the timeline: its brightening on the main sequence and the habitable zone it sets. */
import type { Facts } from "@/lib/facts";
import { MODEL_START } from "@/space/solar-system/model/parameters";

import { HABITABLE_ZONE_AU } from "../parameters";
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
    zoneInner: {
      value: HABITABLE_ZONE_AU[0],
      unit: "au",
      source: "kopparapu2013",
      status: "verified",
      note: "moist greenhouse: the conservative inner edge, clouds left out",
    },
    zoneOuter: {
      value: HABITABLE_ZONE_AU[1],
      unit: "au",
      source: "kopparapu2013",
      status: "verified",
      note: "maximum greenhouse: the conservative outer edge",
    },
  },
} as const satisfies Record<string, Facts>;
