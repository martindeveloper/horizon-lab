/**
 * Deep Field's drift on its rig: the shared visiting drift (`@/space/drift-visits`) with the
 * programme's shots resolved to the ladder's framings, its visits handoffs to the probe
 * close-up: the probe selected and its close-up opened, one dive in, a slow circle that drifts
 * nearer, and one pull away on the next shot's flight.
 */
import { ambientMusic } from "@/components/shell/ambient-music";
import { createVisitingDrift, type VisitFrame } from "@/space/drift-visits";
import type { OrbitPose } from "@horizon/toolkit/camera";

import { DRIFT } from "../drift";
import { canCloseUp, type useDeepField } from "../store";
import type { CameraRig } from "./camera-rig";

export function createDriftDirector(
  rig: CameraRig,
  store: typeof useDeepField,
  options: {
    reduceMotion: { matches: boolean };
    /** The probe close-up, as a visit drives it (`createProbeCloseUp`). */
    closeUp: {
      readonly current: VisitFrame | null;
      release: (landing: OrbitPose) => void;
      reclaim: () => void;
      end: () => void;
    };
  },
) {
  const { reduceMotion, closeUp } = options;
  return createVisitingDrift(rig, DRIFT, {
    reduceMotion,
    store,
    musicPosition: () => ambientMusic.position,
    visits: {
      open: (id) => {
        const selection = { kind: "reach", id } as const;
        const s = store.getState();
        if (!canCloseUp({ ...s, selection })) return false;
        s.select(selection);
        s.enterCloseUp();
        return true;
      },
      /* Letting the selection go leaves the close-up too, unless its flight out was released. */
      letGo: () => store.getState().select(null),
      leave: () => {
        const s = store.getState();
        if (s.closeUp) s.leaveCloseUp();
      },
      closeUp: () => closeUp.current,
      release: (landing) => closeUp.release(landing),
      reclaim: () => closeUp.reclaim(),
      finish: () => closeUp.end(),
    },
  });
}
