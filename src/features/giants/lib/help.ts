import type { HelpStep } from "@/lib/help";

import { DEFAULT_RUNG, rungIndex } from "./model/rungs";
import type { GiantsStore } from "./store";

/** One button step of the globe in focus, to the left. */
const LEFT = { azimuth: -1, inclination: 0 };
/** The camera step's zoom out along the ladder, and back. */
const WIDER = 4;
/** The body the Bodies step picks, and the one the ladder's step slides back to. */
const PICKED = rungIndex("betelgeuse");
const HOME = rungIndex(DEFAULT_RUNG);

/**
 * The `?` tour: the camera, the bodies, the overview, the ladder, the scale bar, the View
 * panel, the guide and the experiences, each shown by doing what it does.
 */
export const HELP: readonly HelpStep<GiantsStore>[] = [
  {
    id: "camera",
    cues: [
      { run: (s) => s.setOverview(false) },
      { run: (s) => s.camera?.turn(LEFT) },
      { at: 0.5, run: (s) => s.camera?.turn(LEFT) },
      { at: 1, run: (s) => s.camera?.turn(LEFT) },
      { at: 1.8, run: (s) => s.camera?.zoom(WIDER) },
      { at: 4, run: (s) => s.camera?.zoom(1 / WIDER) },
    ],
  },
  {
    id: "stars",
    targets: ["stars"],
    cues: [{ run: (s) => s.setPanel("stars") }, { at: 1, run: (s) => s.go(PICKED) }],
  },
  {
    id: "overview",
    targets: ["overview", "more"],
    cues: [{ run: (s) => s.setPanel("none") }, { at: 0.4, run: (s) => s.setOverview(true) }],
  },
  {
    id: "ladder",
    targets: ["ladder"],
    cues: [{ at: 0.4, run: (s) => s.go(HOME) }],
  },
  {
    id: "ruler",
    targets: ["ruler"],
    cues: [{ at: 0.4, run: (s) => s.setRuler("earth") }],
  },
  {
    id: "settings",
    targets: ["settings"],
    cues: [{ run: (s) => s.setPanel("view") }, { at: 1, run: (s) => s.setOrbits(true) }],
  },
  {
    id: "guide",
    targets: ["guide"],
    cues: [{ run: (s) => s.setPanel("none") }],
  },
  { id: "experiences", targets: ["experiences"] },
];
