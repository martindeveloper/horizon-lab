import type { HelpStep } from "@/lib/help";

import { FULL_RANGE, WINDOWS } from "./model/scenes";
import type { SpectroscopyStore } from "./store";

const windowOf = (id: (typeof WINDOWS)[number]["id"]) =>
  WINDOWS.find((w) => w.id === id)?.range ?? FULL_RANGE;

/** Hβ, strong in every star of the sequence. */
const H_BETA = "h1-486.135";
/** A cool star beside the hot one the stars view opens on. */
const COOL_STAR = "arcturus";
/** A recession the shifted lines show at a glance, km/s. */
const RECEDING = 150;

/**
 * The `?` tour: the spectrum's window, the views, the elements, a line's card, the star and its
 * motion, the View panel, the guide and the experiences, each shown by doing what it does.
 */
export const HELP: readonly HelpStep<SpectroscopyStore>[] = [
  {
    id: "spectrum",
    cues: [
      { at: 0.4, run: (s) => s.setRange(windowOf("nad")) },
      { at: 2.2, run: (s) => s.setRange(FULL_RANGE) },
    ],
  },
  {
    id: "views",
    targets: ["views"],
    press: true,
    cues: [{ at: 1, run: (s) => s.setView("stars") }],
  },
  {
    id: "elements",
    targets: ["elements"],
    cues: [{ run: (s) => s.setPanel("elements") }],
  },
  {
    id: "line",
    targets: ["line"],
    cues: [
      { run: (s) => s.setPanel("none") },
      {
        at: 0.4,
        run: (s) => {
          s.setRange(windowOf("balmer"));
          s.select(H_BETA);
        },
      },
    ],
  },
  {
    id: "star",
    targets: ["source"],
    cues: [
      { run: (s) => s.select(null) },
      { at: 0.4, run: (s) => s.setStar(COOL_STAR) },
      { at: 1.6, run: (s) => s.setVelocity(RECEDING) },
    ],
  },
  {
    id: "settings",
    targets: ["settings"],
    cues: [{ run: (s) => s.setPanel("view") }, { at: 1, run: (s) => s.setNormalized(true) }],
  },
  {
    id: "guide",
    targets: ["guide"],
    cues: [{ run: (s) => s.setPanel("none") }],
  },
  { id: "experiences", targets: ["experiences"] },
];
