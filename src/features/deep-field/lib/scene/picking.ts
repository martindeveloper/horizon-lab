/** Taps on the canvas or a name select what is under them; a second tap on a body flies in. */
import type { Object3D } from "three";

import { GALAXY_LAYER } from "@/space/galaxy/scene/frames";
import { isWorldPick } from "@/space/galaxy/show";
import { canFlyTo, closeUpKey, sameSystem } from "@/space/solar-system/model/close-up";
import { selectTapped } from "@/space/solar-system/model/framing";
import { isReachSelection } from "@/space/solar-system/model/probes";
import { isSolarSelection, solarPick } from "@/space/solar-system/model/selection";
import { CLOSE_UP_LAYERS } from "@/space/solar-system/scene/close-up";
import { chooseSolarHit } from "@/space/solar-system/scene/solar-system";
import { createDoubleTap, createTapPicking, type LabelHit } from "@horizon/toolkit/scene";

import type { Selection, useDeepField } from "../store";
import type { SceneKit } from "./kit";

export function createPicking(
  kit: SceneKit,
  canvas: HTMLCanvasElement,
  store: typeof useDeepField,
  options: {
    pickables: Object3D[];
    /** Taps are ignored while the guide, the drift or a close-up's flight holds the camera. */
    blocked: () => boolean;
    /** Camera distance from its aim, au. */
    distance: () => number;
    /** Names readable enough to tap, and what each opens. */
    labels: () => LabelHit[];
    labelPick: (key: string) => Selection | undefined;
  },
) {
  /** A second tap on the same body flies in for a close-up. */
  const secondTap = createDoubleTap();

  /* The Galaxy and the cosmic map draw in their own pass but are picked like the rest, as are
     the bodies a close-up draws in its own. In a close-up, taps never pull the camera away;
     Back, Escape or zooming out do. Its own system still answers: a tap on the Moon from the
     Earth's shows its card, and a second tap flies on to it, as on the map. */
  createTapPicking(kit, canvas, {
    pickables: options.pickables,
    choose: chooseSolarHit,
    layers: [GALAXY_LAYER, ...CLOSE_UP_LAYERS],
    blocked: options.blocked,
    labels: options.labels,
    labelPick: options.labelPick,
    onTap: (target) => {
      const api = store.getState();
      let pick: Selection | null;
      if (api.closeUp) {
        pick = target && solarPick(target.pick, target.instance);
        if (!pick || api.closeUp.kind === "reach" || !sameSystem(pick, api.closeUp)) return;
        api.select(pick);
      } else if (!target) {
        api.select(null);
        return;
      } else {
        pick = selectTapped(api, target, 1, options.distance());
        if (!pick && isWorldPick(target.pick)) {
          pick = target.pick;
          api.select(pick);
        }
      }
      if (!pick || !(canFlyTo(pick) || (isReachSelection(pick) && pick.id !== "heliopause")))
        return;
      const key = isSolarSelection(pick) ? closeUpKey(pick) : `reach:${pick.id}`;
      if (secondTap(key)) api.enterCloseUp();
    },
  });
}
