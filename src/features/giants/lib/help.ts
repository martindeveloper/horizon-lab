import { cameraStep, closingSteps, type HelpStep } from "@/lib/help";

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
 * The `?` tour: the camera, the bodies, the overview, the ladder, the scale bar, the guide,
 * the View panel and the experiences, each shown by doing what it does.
 */
export const HELP: readonly HelpStep<GiantsStore>[] = [
  cameraStep<GiantsStore>(LEFT, { zoom: WIDER, zoomBack: 4, before: (s) => s.setOverview(false) }),
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
  ...closingSteps<GiantsStore>({
    open: (s) => s.setPanel("view"),
    show: (s) => s.setOrbits(true),
    close: (s) => s.setPanel("none"),
  }),
];
