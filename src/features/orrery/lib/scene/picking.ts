/** Taps on the canvas or a name select what is under them; a second tap on a body flies in. */
import type { Object3D } from "three";

import { selectTapped } from "@/space/solar-system/model/framing";
import { migrationProgress } from "@/space/solar-system/model/moment";
import {
  hasSurface,
  selectionKey,
  type SolarSelection,
} from "@/space/solar-system/model/selection";
import type { SolarKit } from "@/space/solar-system/scene/kit";
import { createTapPicking, type LabelHit } from "@horizon/toolkit/scene";

import type { useOrrery } from "../store";

/** A second tap on the same body within this window flies in for a close-up. */
const DOUBLE_TAP_MS = 380;

export function createPicking(
  kit: SolarKit,
  canvas: HTMLCanvasElement,
  store: typeof useOrrery,
  options: {
    pickables: Object3D[];
    /** Taps are ignored while the guide or a close-up holds the camera. */
    blocked: () => boolean;
    distance: () => number;
    /** Names readable enough to tap, and what each opens. */
    labels: () => LabelHit[];
    labelPick: (key: string) => SolarSelection | undefined;
  },
) {
  let lastTapKey = "";
  let lastTapAt = 0;

  /* In a close-up, taps never pull the camera away; Back, Escape or zooming out do. */
  createTapPicking(kit, canvas, {
    pickables: options.pickables,
    blocked: options.blocked,
    labels: options.labels,
    labelPick: options.labelPick,
    onTap: (target) => {
      const api = store.getState();
      if (!target) {
        api.select(null);
        return;
      }
      const pick = selectTapped(api, target, migrationProgress(api.yearsAgo), options.distance());
      if (!pick || pick.kind === "tracer") return;
      const key = selectionKey(pick);
      const at = performance.now();
      const twice = key === lastTapKey && at - lastTapAt < DOUBLE_TAP_MS;
      lastTapKey = twice ? "" : key;
      lastTapAt = at;
      if (twice && hasSurface(pick)) api.enterCloseUp();
    },
  });
}
