import type { CuedShot, DriftProgramme } from "@/lib/drift";
import {
  DRIFT_VISIT,
  withVisitFlights,
  type VisitSettings,
  type VisitShot,
} from "@/space/drift-visits";
/**
 * Deep Field's drift: the lean-back journey up and down the distance ladder, timed to
 * "Drifting Probe" (267.4 s, looping every 259.4 s after the player's 8 s crossfade). The
 * track undulates through its first minute and a half, hushes at 99 s, builds from there to a
 * broad peak at 190–220 s, drops at 233 s and settles. The journey meets it by the track's
 * map: the dive home `at` its start; out to the heliosphere and down to Voyager 1 at its true
 * size, circled a while (a visit, `@/space/drift-visits`); the pull away from it carrying on to
 * the Oort cloud, which lands on `quiet`, the Sun one star among many; the climb up the ladder
 * through the build, the cosmic web landing on `peak`; the observable universe held through
 * the plateau; and the fall back to the Galaxy landing on the drop, the second fall reaching
 * the Kuiper belt as the loop closes. Two rungs the ladder has (the Virgo cluster, Laniakea)
 * are flown through, not held, so the climb keeps the music's pace. The holds written here are
 * the timing without a map and add up to the period; `timeShots` sets them so the cued shots
 * meet their cues, the hold at Voyager lingering as needed. Lengths never vary between loops;
 * angles and distances still vary a little.
 */
import type { ProbeId } from "@/space/solar-system/model/probes";
import type { DriftPoseShot, OrbitPose } from "@horizon/toolkit/camera";

import type { ViewId } from "./model/view-ids";

export type DeepFieldDriftShot =
  | (CuedShot &
      Omit<DriftPoseShot, keyof OrbitPose> & {
        /** The view the shot frames, as the ladder frames it. */
        view: ViewId;
        /** Nudges to that framing. */
        pose?: Partial<OrbitPose>;
      })
  | VisitShot<ProbeId>;

export type DeepFieldDrift = DriftProgramme<DeepFieldDriftShot> & {
  /** At a probe (`VisitSettings`). */
  closeUp: VisitSettings;
};

/** Seconds of a framed shot's flight when its shot names none, and seconds held at a probe. */
const FLIGHT = 18;
const VISIT_HOLD = 12;

export const DRIFT: DeepFieldDrift = {
  music: { track: "Drifting Probe", period: 259.4 },
  camera: {
    flight: FLIGHT,
    hold: 6,
    variance: 0.25,
    timeVariance: 0,
    drift: 0.012,
    creep: 0.06,
    order: "sequence",
  },
  closeUp: { ...DRIFT_VISIT, hold: VISIT_HOLD },
  shots: withVisitFlights(
    [
      /* Home, from wherever the camera was: a dive to the inner planets as the track opens. */
      {
        at: "start",
        view: "inner",
        pose: { inclination: 0.95 },
        flight: { duration: 18, lift: 0.12, lead: 0.3 },
        hold: 5,
        drift: 0.016,
      },
      /* Out past the giants to the heliosphere, the probes on their way out of it. */
      { view: "heliosphere", flight: { duration: 18, lift: 0.1 }, hold: 3 },
      /* Down to Voyager 1, the farthest of them, a few metres of spacecraft at its true size. */
      { closeUp: "voyager1", hold: VISIT_HOLD },
      /* Pulled away from it on to the Oort cloud, landing on the hush: the solar system behind
         us, the Sun one star among many. */
      { land: "quiet", view: "oort", flight: { duration: 20, lead: 0.2 }, hold: 8 },
      /* Out of the solar system: the orbit frame turns to the Galaxy on the way; the build begins. */
      { view: "stars", flight: { duration: 16, lift: 0.15 }, hold: 4 },
      { view: "galaxy", flight: { duration: 18, lead: -0.3 }, hold: 5 },
      { view: "local-group", flight: { duration: 14 }, hold: 2 },
      /* The cosmic web lands on the peak. */
      { land: "peak", view: "cosmic-web", flight: { duration: 24, lead: 0.3 }, hold: 2 },
      /* The observable universe, held through the plateau, pulling slowly back. */
      { view: "observable-universe", flight: { duration: 16 }, hold: 5, creep: -0.04 },
      /* The fall: the Galaxy lands on the drop, then the second fall reaches inside the
         heliopause, whose faint bubble would fill the whole frame from just outside it, as the
         loop closes. */
      {
        land: "breath-3",
        view: "galaxy",
        pose: { inclination: 1.1 },
        flight: { duration: 20, lift: 0.1 },
        hold: 6,
      },
      { view: "kuiper", pose: { distance: 95 }, flight: { duration: 18, lead: 0.3 }, hold: 2 },
    ],
    DRIFT_VISIT.pace,
    FLIGHT,
  ),
};
