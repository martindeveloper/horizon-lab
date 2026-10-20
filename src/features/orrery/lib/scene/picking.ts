/** Taps on the canvas or a name select what is under them; a second tap on a body flies in. */
import type { Object3D } from "three";

import { selectTapped } from "@/space/solar-system/model/framing";
import { migrationProgress } from "@/space/solar-system/model/moment";
import {
  hasSurface,
  sameSystem,
  selectionKey,
  solarPick,
  type SolarSelection,
} from "@/space/solar-system/model/selection";
import type { SolarKit } from "@/space/solar-system/scene/kit";
import { chooseSolarHit } from "@/space/solar-system/scene/solar-system";
import { createTapPicking, type LabelHit } from "@horizon/toolkit/scene";

import type { useOrrery } from "../store";
import { CLOSE_UP_LAYERS } from "./close-up-controller";

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

  /* In a close-up, taps never pull the camera away; Back, Escape or zooming out do. Its own
     system still answers: a tap on the Moon from the Earth's shows the Moon's card, and a
     second tap flies on to it, as on the map. */
  createTapPicking(kit, canvas, {
    pickables: options.pickables,
    choose: chooseSolarHit,
    layers: CLOSE_UP_LAYERS,
    blocked: options.blocked,
    labels: options.labels,
    labelPick: options.labelPick,
    onTap: (target) => {
      const api = store.getState();
      let pick;
      if (api.closeUp) {
        pick = target && solarPick(target.pick, target.instance);
        if (!pick || !sameSystem(pick, api.closeUp)) return;
        api.select(pick);
      } else if (!target) {
        api.select(null);
        return;
      } else pick = selectTapped(api, target, migrationProgress(api.yearsAgo), options.distance());
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
