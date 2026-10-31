import { cameraStep, closingSteps, type HelpStep } from "@/lib/help";

import { RGB_TIP } from "./model/track";
import type { AfterglowStore } from "./store";

/** One button step of the view, to the left. */
const LEFT = { azimuth: -1, inclination: 0 };
/** A million years before the tip: the giant filling the sky. */
const SWEEP_AGE = RGB_TIP - 1e6;

/**
 * The `?` tour: the view, the timeline (a scrub, then a chapter), the
 * worlds, the clock, the atlas, the guide, the settings and the experiences, each shown by
 * doing what it does.
 */
export const HELP: readonly HelpStep<AfterglowStore>[] = [
  cameraStep<AfterglowStore>(LEFT),
  {
    id: "timeline",
    targets: ["timeline"],
    cues: [
      { at: 0.4, run: (s) => s.setAge(SWEEP_AGE) },
      { at: 2.2, run: (s) => s.setView("nebula") },
    ],
  },
  {
    id: "worlds",
    targets: ["worlds"],
    cues: [{ at: 0.4, run: (s) => s.standOn("mars") }],
  },
  {
    id: "clock",
    targets: ["clock"],
    cues: [{ run: (s) => s.setPlaying(true) }, { at: 3, run: (s) => s.setPlaying(false) }],
  },
  {
    id: "atlas",
    targets: ["atlas"],
    cues: [{ run: (s) => s.setAtlas(true) }],
  },
  ...closingSteps<AfterglowStore>({
    beforeGuide: (s) => s.setAtlas(false),
    open: (s) => s.setPanel("settings"),
    show: (s) => s.patchShow({ glare: false }),
    close: (s) => s.setPanel("none"),
  }),
];
