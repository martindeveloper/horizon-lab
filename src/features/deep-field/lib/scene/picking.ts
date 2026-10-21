/** Taps on the canvas or a name select what is under them; a tap on nothing lets go. */
import type { Object3D } from "three";

import { GALAXY_LAYER } from "@/space/galaxy/scene/frames";
import { isWorldPick } from "@/space/galaxy/show";
import { selectTapped } from "@/space/solar-system/model/framing";
import { chooseSolarHit } from "@/space/solar-system/scene/solar-system";
import { createTapPicking, type LabelHit } from "@horizon/toolkit/scene";

import type { Selection, useDeepField } from "../store";
import type { SceneKit } from "./kit";

export function createPicking(
  kit: SceneKit,
  canvas: HTMLCanvasElement,
  store: typeof useDeepField,
  options: {
    pickables: Object3D[];
    /** Camera distance from its aim, au. */
    distance: () => number;
    /** Names readable enough to tap, and what each opens. */
    labels: () => LabelHit[];
    labelPick: (key: string) => Selection | undefined;
  },
) {
  /* The Galaxy and the cosmic map draw in their own pass but are picked like the rest. */
  createTapPicking(kit, canvas, {
    pickables: options.pickables,
    choose: chooseSolarHit,
    layers: [GALAXY_LAYER],
    blocked: () => false,
    labels: options.labels,
    labelPick: options.labelPick,
    onTap: (target) => {
      const api = store.getState();
      if (!target) return api.select(null);
      if (selectTapped(api, target, 1, options.distance())) return;
      if (isWorldPick(target.pick)) api.select(target.pick);
    },
  });
}
