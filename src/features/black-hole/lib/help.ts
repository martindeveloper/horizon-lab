import type { HelpStep } from "@/lib/help";

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
  {
    id: "camera",
    cues: [
      { run: (s) => s.camera?.turn(LEFT) },
      { at: 1.8, run: (s) => s.camera?.zoom(0.7) },
      { at: 3.4, run: (s) => s.camera?.zoom(1 / 0.7) },
    ],
  },
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
  {
    id: "guide",
    targets: ["guide"],
    cues: [{ run: (s) => s.setClocksOpen(false) }],
  },
  {
    id: "settings",
    targets: ["settings"],
    cues: [
      {
        run: (s) => {
          s.setClocksOpen(false);
          s.setSettingsOpen(true);
        },
      },
      { at: 1, run: (s) => s.setGravity(false) },
    ],
  },
  {
    id: "experiences",
    targets: ["experiences"],
    cues: [{ run: (s) => s.setSettingsOpen(false) }],
  },
];
