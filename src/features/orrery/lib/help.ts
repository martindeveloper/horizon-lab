import type { HelpStep } from "@/lib/help";
import { isPresentEra } from "@/space/solar-system/model/moment";
import type { SolarSelection } from "@/space/solar-system/model/selection";

import type { OrreryStore } from "./store";

/** One button step round the Sun, to the left. */
const LEFT = { azimuth: -1, inclination: 0 };

/** The body the tour finds and flies in to. */
const JUPITER: SolarSelection = { kind: "planet", id: "jupiter" };

/**
 * The `?` tour: the camera, the views, the objects, a close-up, the time dock, the guide, the
 * View panel and the experiences, each shown by doing what it does.
 */
export const HELP: readonly HelpStep<OrreryStore>[] = [
  {
    id: "camera",
    cues: [
      { run: (s) => s.camera?.turn(LEFT) },
      { at: 0.5, run: (s) => s.camera?.turn(LEFT) },
      { at: 1, run: (s) => s.camera?.turn(LEFT) },
      { at: 1.8, run: (s) => s.camera?.zoom(0.7) },
      { at: 3.4, run: (s) => s.camera?.zoom(1 / 0.7) },
    ],
  },
  {
    id: "views",
    targets: ["views"],
    press: true,
    cues: [{ at: 1, run: (s) => s.setView("inner") }],
  },
  {
    id: "objects",
    targets: ["objects"],
    cues: [
      { run: (s) => s.setPanel("objects") },
      {
        at: 1.2,
        run: (s) => {
          s.select(JUPITER);
          s.setPanel("none");
        },
      },
    ],
  },
  {
    /* Close-ups show today's surfaces: the clock comes home first if it is far back. */
    id: "closeUp",
    targets: ["closeUp"],
    cues: [
      { run: (s) => s.setPanel("none") },
      {
        at: 0.6,
        run: (s) => {
          s.select(JUPITER);
          if (!isPresentEra(s.yearsAgo)) s.setYearsAgo(0);
          s.enterCloseUp();
        },
      },
    ],
  },
  {
    /* The card gives way, so a phone shows the whole dock. */
    id: "time",
    targets: ["time"],
    cues: [{ run: (s) => s.select(null) }, { at: 0.6, run: (s) => s.replay() }],
  },
  { id: "guide", targets: ["guide"] },
  {
    id: "settings",
    targets: ["settings"],
    cues: [
      { run: (s) => s.setPanel("view") },
      { at: 1, run: (s) => s.patchShow({ distances: true }) },
    ],
  },
  {
    id: "experiences",
    targets: ["experiences"],
    cues: [{ run: (s) => s.setPanel("none") }],
  },
];
