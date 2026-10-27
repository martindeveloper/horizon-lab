import { cameraStep, closingSteps, type HelpStep } from "@/lib/help";

import { DEFAULT_PRESET_ID } from "./holes/routes";
import type { BlackHoleStore } from "./store";

/** Three button steps round the hole, to the left: one sweep. */
const LEFT = { azimuth: -3, inclination: 0 };

/** The holes the picker's step shows: the first that is not the visitor's own. */
const SHOWN = ["m87", DEFAULT_PRESET_ID] as const;

/**
 * The `?` tour: the camera, the holes, the gauge, the atlas, the clocks, the guide, the View
 * panel and the experiences, each shown by doing what it does.
 */
export const HELP: readonly HelpStep<BlackHoleStore>[] = [
  cameraStep<BlackHoleStore>(LEFT, { turns: 1 }),
  {
    id: "views",
    targets: ["views"],
    press: true,
    cues: [
      {
        at: 1,
        run: (s) => {
          const own = s.savedBeforeHelp?.scene.presetId;
          s.applyPreset(SHOWN.find((id) => id !== own) ?? DEFAULT_PRESET_ID);
        },
      },
    ],
  },
  {
    id: "gauge",
    targets: ["gauge"],
    cues: [{ at: 0.4, run: (s) => s.setActivePin("photon") }],
  },
  { id: "atlas", targets: ["atlas"] },
  {
    id: "clocks",
    targets: ["clocks", "more"],
    cues: [{ at: 0.4, run: (s) => s.setClocksOpen(true) }],
  },
  ...closingSteps<BlackHoleStore>({
    beforeGuide: (s) => s.setClocksOpen(false),
    open: (s) => {
      s.setClocksOpen(false);
      s.setSettingsOpen(true);
    },
    show: (s) => s.setGravity(false),
    close: (s) => s.setSettingsOpen(false),
  }),
];
