import type { HelpStep } from "@/lib/help";

import { CLOCK_RATES, DEFAULT_COMPRESSION } from "./model/parameters";
import type { VoyageStore } from "./store";

/** A day a second: the worlds turn at a glance. */
const DAY = CLOCK_RATES.find(({ id }) => id === "day")?.value ?? DEFAULT_COMPRESSION;
/** The lever's push the tour shows: a burn the held clocks keep from moving the ship. */
const BURN = 0.6;

/**
 * The `?` tour: the camera, the destinations and the drives, the clocks, the lever, the
 * guide, the View panel and the experiences, each shown by doing what it does.
 */
export const HELP: readonly HelpStep<VoyageStore>[] = [
  { id: "camera" },
  {
    id: "objects",
    targets: ["objects"],
    cues: [{ run: (s) => s.setPanel("objects") }],
  },
  {
    id: "drive",
    targets: ["drive"],
    cues: [{ run: (s) => s.setPanel("objects") }, { at: 0.8, run: (s) => s.setDrive("voyager") }],
  },
  {
    id: "rate",
    targets: ["rate"],
    cues: [
      { run: (s) => s.setPanel("none") },
      { at: 0.4, run: (s) => s.setCompression(0) },
      { at: 1.6, run: (s) => s.setCompression(DAY) },
    ],
  },
  {
    /* The clocks hold while the lever moves, so the ship keeps the course the visitor had. */
    id: "throttle",
    targets: ["throttle"],
    cues: [
      { run: (s) => s.setCompression(0) },
      { at: 0.4, run: (s) => s.setThrottle(BURN) },
      { at: 2, run: (s) => s.setThrottle(0) },
    ],
  },
  { id: "guide", targets: ["guide"] },
  {
    id: "settings",
    targets: ["settings"],
    cues: [
      { run: (s) => s.setPanel("view") },
      { at: 1, run: (s) => s.patchShow({ canopy: false }) },
    ],
  },
  {
    id: "experiences",
    targets: ["experiences"],
    cues: [{ run: (s) => s.setPanel("none") }],
  },
];
