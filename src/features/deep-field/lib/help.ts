import type { HelpStep } from "@/lib/help";

import type { DeepFieldStore, Selection } from "./store";

/** One button step round the aim, to the left. */
const LEFT = { azimuth: -1, inclination: 0 };

/** The galaxy the tour finds; the Local Group's view frames it, as in the Objects panel. */
const ANDROMEDA: Selection = { kind: "cosmos", id: "andromeda" };

/**
 * The `?` tour: the camera, the depth ladder, the sightline, the objects, the guide, the View
 * panel and the experiences, each shown by doing what it does.
 */
export const HELP: readonly HelpStep<DeepFieldStore>[] = [
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
    /* A panel or a card hides the ladder and the sightline on a phone. */
    id: "depth",
    targets: ["depth"],
    cues: [
      {
        run: (s) => {
          s.setPanel("none");
          s.select(null);
        },
      },
      { at: 0.6, run: (s) => s.setView("local-group") },
    ],
  },
  {
    id: "sightline",
    targets: ["sightline"],
    cues: [{ at: 0.6, run: (s) => s.setView("observable-universe") }],
  },
  {
    id: "objects",
    targets: ["objects"],
    cues: [
      { run: (s) => s.setPanel("objects") },
      {
        at: 1.2,
        run: (s) => {
          s.setView("local-group");
          s.select(ANDROMEDA);
          s.setPanel("none");
        },
      },
    ],
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
