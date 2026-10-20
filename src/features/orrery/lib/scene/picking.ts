/** Taps on the canvas or a name select what is under them; a second tap on a body flies in. */
import type { Object3D } from "three";

import { selectTapped } from "@/space/solar-system/model/framing";
import { migrationProgress } from "@/space/solar-system/model/moment";
import {
  hasSurface,
  hostOf,
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

/** The planet (or Pluto) a body belongs with: itself, or a moon's. */
const systemOf = (sel: SolarSelection) => selectionKey(sel.kind === "moon" ? hostOf(sel.id) : sel);

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

  /* In a close-up, taps never pull the camera away; Back, Escape or zooming out do. A tap on
     another body of its planet's system (the Moon from the Earth) flies straight there. */
  createTapPicking(kit, canvas, {
    pickables: options.pickables,
    choose: chooseSolarHit,
    layers: CLOSE_UP_LAYERS,
    blocked: options.blocked,
    labels: options.labels,
    labelPick: options.labelPick,
    onTap: (target) => {
      const api = store.getState();
      if (api.closeUp) {
        const pick = target && solarPick(target.pick, target.instance);
        const from = api.selection;
        if (pick && from && hasSurface(pick) && systemOf(pick) === systemOf(from))
          if (selectionKey(pick) !== selectionKey(from)) api.switchCloseUp(pick);
        return;
      }
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
