/** Taps on the canvas or a name select the body under them; a tap on nothing lets go. */
import type { Object3D } from "three";

import type { WorldSelection } from "@/space/galaxy/show";
import { solarPick } from "@/space/solar-system/model/selection";
import { chooseSolarHit } from "@/space/solar-system/scene/solar-system";
import { createTapPicking, type LabelHit } from "@horizon/toolkit/scene";

import type { useVoyage } from "../store";
import type { VoyageKit } from "./kit";

export function createPicking(
  kit: VoyageKit,
  canvas: HTMLCanvasElement,
  store: typeof useVoyage,
  options: {
    pickables: Object3D[];
    /** Taps wait while a flight owns the camera. */
    blocked: () => boolean;
    /** Names readable enough to tap, and what each opens. */
    labels: () => LabelHit[];
    labelPick: (key: string) => WorldSelection | undefined;
    /** Render layers to raycast besides the default one. */
    layers: readonly number[];
  },
) {
  createTapPicking(kit, canvas, {
    pickables: options.pickables,
    choose: chooseSolarHit,
    layers: options.layers,
    blocked: options.blocked,
    labels: options.labels,
    labelPick: options.labelPick,
    onTap: (target) => {
      const api = store.getState();
      if (!target) return api.select(null);
      const sel = solarPick(target.pick, target.instance);
      if (sel) return api.select(sel);
      if (isFarSelection(target.pick)) api.select(target.pick);
    },
  });
}

function isFarSelection(value: unknown): value is WorldSelection {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    (value.kind === "galaxy" ||
      value.kind === "cosmos" ||
      value.kind === "star" ||
      value.kind === "reach") &&
    "id" in value &&
    typeof value.id === "string"
  );
}
