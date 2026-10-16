/**
 * Measured maps (`MAPS`) replace the painted stand-ins once the first frame is up,
 * one at a time and off the critical path; a failure keeps the painted map.
 */
import type { Texture } from "three";

import { keysOf } from "@/lib/records";
import { MAPS, tierFile, type BodyId } from "@horizon/toolkit/bodies";
import type { DisposalScope } from "@horizon/toolkit/rendering";

import { MAP_BASE, loadMap } from "../graphics/map-loader";

export function createMeasuredMaps(
  scope: DisposalScope,
  onLoad: (id: BodyId, texture: Texture) => void,
) {
  const abort = new AbortController();
  scope.defer(() => abort.abort());
  let requested = false;

  const load = async () => {
    for (const id of keysOf(MAPS)) {
      const file = tierFile(MAP_BASE, id, "far");
      if (!file) continue;
      try {
        const texture = await loadMap(file, abort.signal);
        if (abort.signal.aborted) texture.dispose();
        else onLoad(id, texture);
      } catch {
        if (abort.signal.aborted) return;
      }
    }
  };

  return {
    /** Starts loading once, after the first frame, when the browser is idle. */
    request() {
      if (requested) return;
      requested = true;
      /* Safari has no idle callback. */
      const idle =
        "requestIdleCallback" in window && typeof window.requestIdleCallback === "function"
          ? window.requestIdleCallback.bind(window)
          : undefined;
      if (idle) idle.call(window, () => void load());
      else setTimeout(() => void load(), 300);
    },
  };
}
