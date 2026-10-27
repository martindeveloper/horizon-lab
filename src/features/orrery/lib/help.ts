import { cameraStep, closingSteps, type HelpStep } from "@/lib/help";
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
  cameraStep<OrreryStore>(LEFT),
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
  {
    /* The switch is in the View panel (phones have no other); Earth holds still among the
       inner planets, and time runs so the loops draw. */
    id: "fromEarth",
    targets: ["settings"],
    cues: [
      {
        run: (s) => {
          s.setPanel("view");
          if (!isPresentEra(s.yearsAgo)) {
            s.setYearsAgo(0);
          }
          s.setView("inner");
          s.patchShow({ fromEarth: true });
          if (!s.playing) {
            s.togglePlay();
          }
        },
      },
    ],
  },
  {
    /* The clock's moments, by the clock. */
    id: "moments",
    targets: ["moments"],
    cues: [{ run: (s) => s.setPanel("moments") }],
  },
  ...closingSteps<OrreryStore>({
    open: (s) => s.setPanel("view"),
    show: (s) => s.patchShow({ distances: true }),
    close: (s) => s.setPanel("none"),
  }),
];
