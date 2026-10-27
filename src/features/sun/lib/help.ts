import { cameraStep, closingSteps, type HelpStep } from "@/lib/help";

import { PLACE_LIST } from "./model/places";
import type { SunStore } from "./store";

/** One button step round the Sun, to the left. */
const LEFT = { azimuth: -1, inclination: 0 };

/**
 * The `?` tour: the camera, the views, the light, the clock, the places in view, the finder,
 * the guide, the View panel and the experiences, each shown by doing what it does.
 */
export const HELP: readonly HelpStep<SunStore>[] = [
  cameraStep<SunStore>(LEFT),
  {
    id: "views",
    targets: ["views"],
    press: true,
    cues: [{ at: 1, run: (s) => s.setView("corona") }],
  },
  {
    id: "light",
    targets: ["light"],
    cues: [
      { at: 0.4, run: (s) => s.setLight("halpha") },
      { at: 1.8, run: (s) => s.setLight("fe171") },
    ],
  },
  {
    id: "clock",
    targets: ["clock"],
    cues: [{ at: 0.4, run: (s) => s.setClock("day") }],
  },
  {
    id: "places",
    targets: ["places"],
    cues: [
      {
        at: 0.4,
        run: (s) => {
          const place = PLACE_LIST.find(({ view }) => view === s.view);
          if (place) s.goTo(place.id);
        },
      },
    ],
  },
  {
    id: "finder",
    targets: ["finder"],
    cues: [{ run: (s) => s.setPanel("places") }],
  },
  ...closingSteps<SunStore>({
    open: (s) => s.setPanel("view"),
    show: (s) => s.patchShow({ grid: true }),
    close: (s) => s.setPanel("none"),
  }),
];
