import type { DriftProgramme } from "@/lib/drift";
/**
 * The Orrery's drift: the lean-back tour of the solar system, wide across the orbits one moment
 * and down at a world's surface the next. A shot is a view's framing, nudged in distance and
 * tilt, or a close-up: the drift selects the body, flies in on the close-up's own flight, circles
 * it slowly while it drifts nearer, and flies back out. The camera (`createDriftCamera`) spreads
 * angles, distance and timing a little each pass. While the drift is on, the Motion speed-up
 * (the Orrery's own, unrelated "drift" switch) is held to `clock` model years per real second,
 * so the inner planets and the belt glide rather than whirl when seen from the giants.
 */
import type { SolarSelection } from "@/space/solar-system/model/selection";
import type { SolarViewId } from "@/space/solar-system/model/views";
import type { DriftPoseShot, OrbitPose } from "@horizon/toolkit/camera";

import type { MoonSwing } from "./scene/close-up-flight";

/** A body the close-up can frame: the Sun, a planet or a named body. */
export type CloseUpBody = Extract<SolarSelection, { kind: "sun" | "planet" | "named" }>;

export type OrreryDriftShot =
  | (Omit<DriftPoseShot, keyof OrbitPose> & {
      /** The view whose framing the shot starts from. */
      view: SolarViewId;
      /** Nudges to that framing. */
      pose?: Partial<OrbitPose>;
    })
  | {
      /** The body to visit at true size, on the close-up's own flights. */
      closeUp: CloseUpBody;
      /** Seconds at the body; the programme's default otherwise. */
      hold?: number;
    };

export type OrreryDrift = DriftProgramme<OrreryDriftShot> & {
  /** The most model years one real second covers while the drift is on; Motion's own rate below it. */
  clock: number;
  /**
   * At a body: seconds held, the slow orbit's rate (rad/s), how near the camera drifts (a
   * fraction of the arrival distance), how many times slower than a tap's the flights in
   * and out are, and when in the hold (fractions) the camera swings out to frame the body
   * with its largest moon, arrives, leaves and is back.
   */
  closeUp: { hold: number; orbit: number; dive: number; pace: number; moon: MoonSwing };
};

export const DRIFT: OrreryDrift = {
  music: { track: "Interstellar Drift" },
  camera: { flight: 22, hold: 12, variance: 0.3, drift: 0.01, creep: 0.05, order: "sequence" },
  clock: 0.04,
  closeUp: { hold: 20, orbit: 0.045, dive: 0.55, pace: 2.6, moon: [0.22, 0.42, 0.62, 0.82] },
  shots: [
    /* Low among the inner planets, then down to Earth. */
    {
      view: "inner",
      pose: { distance: 4.5, inclination: 0.35 },
      flight: { lift: 0.15, lead: 0.3 },
    },
    { closeUp: { kind: "planet", id: "earth" }, hold: 24 },
    {
      view: "inner",
      pose: { distance: 9, inclination: 1.2 },
      flight: { duration: 18, lead: -0.2 },
    },
    { closeUp: { kind: "planet", id: "mars" } },
    /* The giants: framed, then Jupiter, edge-on across their orbits, then Saturn's rings. */
    { view: "giants", pose: { inclination: 0.5 }, flight: { duration: 26, lift: 0.1 } },
    { closeUp: { kind: "planet", id: "jupiter" } },
    {
      view: "giants",
      pose: { distance: 40, inclination: 0.15 },
      flight: { duration: 20, swing: 0.1 },
    },
    { closeUp: { kind: "planet", id: "saturn" }, hold: 24 },
    /* Out through the belt to Neptune and Pluto, on to the Oort cloud. */
    { view: "kuiper", pose: { inclination: 0.9 }, flight: { duration: 24 } },
    { closeUp: { kind: "planet", id: "neptune" } },
    { closeUp: { kind: "named", id: "pluto" }, hold: 16 },
    { view: "scattered", flight: { duration: 28, lead: 0.3 } },
    { view: "oort", flight: { duration: 30 }, hold: 16, creep: -0.04 },
    /* And one long fall back to the giants, from above. */
    { view: "giants", pose: { inclination: 1.3 }, flight: { duration: 34, lift: -0.1 } },
  ],
};
