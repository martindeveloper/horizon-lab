/**
 * The Orrery's drift on its rig: the shared visiting drift (`@/space/drift-visits`) with the
 * programme's framed shots posed by the views and its close-ups handed off to the shared
 * visits: the body selected and its close-up opened, one dive in, a slow circle that drifts
 * nearer, and one pull away. Here the hold ends pulled out to show the body with its largest
 * moon, the pull away leaves from there, and a shot with a timeline sets the clock as its
 * flight begins.
 */
import { ambientMusic } from "@/components/shell/ambient-music";
import { createVisitingDrift, type VisitFrame } from "@/space/drift-visits";
import { moonSwing } from "@/space/solar-system/scene/close-up-framing";
import type { OrbitPose } from "@horizon/toolkit/camera";
import { lerp } from "@horizon/toolkit/math";

import { DRIFT } from "../drift";
import { canCloseUp, type useOrrery } from "../store";
import type { CameraRig } from "./camera-rig";

export function createDriftDirector(
  rig: CameraRig,
  store: typeof useOrrery,
  options: {
    reduceMotion: { matches: boolean };
    closeUp: () => VisitFrame | null;
    /** The pose that frames the visited body with its largest moon, from a pose; null without one. */
    moonPose: (base: OrbitPose) => OrbitPose | null;
    /** Hands the close-up's flight out to the drift's flight landing on `landing`. */
    release: (landing: OrbitPose) => void;
    /** The close-up flies a released flight on to its landing itself. */
    reclaim: () => void;
    /** The released flight has landed: the close-up ends where the drift left the camera. */
    finish: () => void;
  },
) {
  const { reduceMotion, moonPose, closeUp, release, reclaim, finish } = options;
  /** The shot last flown to: a shot's timeline is set once, as its flight begins. */
  let flownTo = -1;
  const drift = createVisitingDrift(rig, DRIFT, {
    reduceMotion,
    store,
    musicPosition: () => ambientMusic.position,
    visits: {
      closeUp,
      release,
      reclaim,
      finish,
      open: (body) => {
        const s = store.getState();
        if (!canCloseUp({ ...s, selection: body })) return false;
        s.select(body);
        s.enterCloseUp();
        return true;
      },
      /* Letting the selection go leaves the close-up too, and takes the body's marker with it. */
      letGo: () => store.getState().select(null),
      leave: () => {
        const s = store.getState();
        if (s.closeUp) s.leaveCloseUp(true);
      },
      /* Out to the largest moon toward the hold's end. */
      frame: (base, t) => {
        const swing = moonSwing(t, DRIFT.closeUp.moon);
        const moon = swing > 0 ? moonPose(base) : null;
        if (!moon) return base;
        return {
          azimuth: lerp(base.azimuth, moon.azimuth, swing),
          inclination: lerp(base.inclination, moon.inclination, swing),
          distance: Math.exp(lerp(Math.log(base.distance), Math.log(moon.distance), swing)),
        };
      },
    },
  });

  return {
    /** How the drift's visits fly; the clock eases with them as well. */
    visitStyle: drift.visitStyle,
    get busy() {
      return drift.busy;
    },
    takeOver: () => drift.takeOver(),
    /** Call before the rig steps. */
    step(dt: number) {
      const state = drift.step(dt);
      if (state === "off") {
        flownTo = -1;
        return;
      }
      const { run } = drift;
      if (run.shot === flownTo) return;
      flownTo = run.shot;
      /* The timed shots keep the programme's order: the shot's own fields are read from it. */
      const shot = DRIFT.shots[flownTo];
      /* Under reduced motion the timeline stays the visitor's: the formation would not play. */
      if (shot && "timeline" in shot && shot.timeline && !reduceMotion.matches) {
        const s = store.getState();
        s.setYearsAgo(shot.timeline.yearsAgo);
        if (!s.playing) s.togglePlay();
      }
    },
  };
}
