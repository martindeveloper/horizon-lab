import type { DriftProgramme } from "@/lib/drift";
/**
 * Deep Field's drift: the lean-back journey up and down the distance ladder. Each shot frames
 * a view as the ladder does, nudged a little; the flights are long, so most of the time is one
 * even zoom, out from the planets to the first light and back in. The camera (`createDriftCamera`)
 * spreads angles, distance and timing a little each pass, so no two runs match.
 */
import type { DriftPoseShot, OrbitPose } from "@horizon/toolkit/camera";

import type { ViewId } from "./model/view-ids";

export type DeepFieldDriftShot = Omit<DriftPoseShot, keyof OrbitPose> & {
  /** The view the shot frames, as the ladder frames it. */
  view: ViewId;
  /** Nudges to that framing. */
  pose?: Partial<OrbitPose>;
};

export const DRIFT: DriftProgramme<DeepFieldDriftShot> = {
  music: { track: "Drifting Probe" },
  camera: { flight: 26, hold: 12, variance: 0.35, drift: 0.012, creep: 0.06, order: "sequence" },
  shots: [
    /* Home, from wherever the camera was: a long dive. */
    { view: "inner", pose: { inclination: 0.95 }, flight: { lift: 0.12, lead: 0.3 }, drift: 0.016 },
    { view: "giants", pose: { inclination: 0.8 }, flight: { duration: 22, lead: -0.3 } },
    { view: "heliosphere", flight: { duration: 24, lift: 0.1 } },
    { view: "oort", flight: { duration: 30, lead: 0.2 } },
    /* Out of the solar system: the orbit frame turns to the Galaxy on the way. */
    { view: "stars", flight: { duration: 28, lift: 0.15 } },
    { view: "galaxy", flight: { duration: 32, lead: -0.3 }, hold: 16 },
    { view: "local-group", flight: { duration: 24 } },
    { view: "virgo-cluster", flight: { duration: 26, lift: 0.1 } },
    { view: "laniakea", flight: { duration: 26 } },
    { view: "cosmic-web", flight: { duration: 28, lead: 0.3 } },
    { view: "observable-universe", flight: { duration: 30 }, hold: 18, creep: -0.04 },
    /* And all the way back in, in two long falls: the second lands inside the heliopause, whose
       faint bubble would fill the whole frame from just outside it. */
    { view: "galaxy", pose: { inclination: 1.1 }, flight: { duration: 36, lift: 0.1 }, hold: 14 },
    { view: "kuiper", pose: { distance: 95 }, flight: { duration: 34, lead: 0.3 } },
  ],
};
