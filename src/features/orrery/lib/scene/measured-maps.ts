/**
 * The map budget: measured far maps (`MAPS`) replace the painted stand-ins by need. Each
 * frame the layers report how large each globe is now and where the zoom is heading
 * (`Lod.see`); a map loads once its body reaches a few pixels there, largest first and one
 * at a time, after the first frame. Over the memory budget, maps of bodies that have stayed
 * below a pixel the longest go back to their painted stand-ins, which reads the same at
 * that size. A failure keeps the painted map.
 */
import type { Texture } from "three";

import { MAPS, tierFile, type BodyId } from "@horizon/toolkit/bodies";
import type { DisposalScope } from "@horizon/toolkit/rendering";

import { MAP_BASE, loadMap } from "../graphics/map-loader";
import type { MapQuality } from "../quality";

/** On-screen radius (px, at the zoom's destination) that asks for the measured map. */
const LOAD_PX = 3;
/** Below this radius a measured map shows nothing a painted one does not. */
const IDLE_PX = 1;
/** Seconds a map must stay idle before the budget may release it. */
const IDLE_S = 20;
/** GPU bytes of a far map with its mip chain (RGBA, height half the width). */
const bytesOf = (width: number) => ((width * width * 4) / 2) * (4 / 3);

type Slot = {
  state: "loading" | "ready" | "failed";
  texture: Texture | null;
  bytes: number;
  /** Clock time the body was last at least `IDLE_PX`. */
  seen: number;
};

export function createMeasuredMaps(
  scope: DisposalScope,
  options: {
    /** The current quality's map settings: the bytes of far maps to keep resident before idle ones are released, and the filtering new maps load with. */
    quality: () => MapQuality;
    /** A map arrived: upload it and put it on its body. */
    onLoad: (id: BodyId, texture: Texture) => void;
    /** A map was released: the body goes back to its painted map. */
    onRelease: (id: BodyId) => void;
    /** Asks for a frame, so the first load starts without waiting for input. */
    wake: () => void;
  },
) {
  const abort = new AbortController();
  const slots = new Map<BodyId, Slot>();
  let clock = 0;
  let ready = false;
  let loading = false;
  let resident = 0;
  scope.defer(() => {
    abort.abort();
    for (const slot of slots.values()) slot.texture?.dispose();
    slots.clear();
  });

  const load = (id: BodyId, file: string) => {
    const slot: Slot = { state: "loading", texture: null, bytes: 0, seen: clock };
    slots.set(id, slot);
    loading = true;
    loadMap(file, abort.signal, options.quality().anisotropy).then(
      (texture) => {
        loading = false;
        if (abort.signal.aborted) {
          texture.dispose();
          return;
        }
        slot.state = "ready";
        slot.texture = texture;
        slot.bytes = bytesOf(MAPS[id]!.widths.far);
        resident += slot.bytes;
        options.onLoad(id, texture);
      },
      () => {
        loading = false;
        slot.state = "failed";
      },
    );
  };

  /** Releases the longest-idle maps while over budget; `keep` is never released. */
  const trim = (keep: BodyId | null) => {
    while (resident > options.quality().budget) {
      let oldest: BodyId | null = null;
      let oldestSeen = clock - IDLE_S;
      for (const [id, slot] of slots) {
        if (slot.state === "ready" && id !== keep && slot.seen < oldestSeen) {
          oldest = id;
          oldestSeen = slot.seen;
        }
      }
      if (!oldest) return;
      const slot = slots.get(oldest)!;
      slots.delete(oldest);
      resident -= slot.bytes;
      options.onRelease(oldest);
    }
  };

  return {
    /**
     * Gives every resident map the current quality's filtering, re-uploading those that change
     * (each keeps its decoded image for that); maps that load later take it as they load.
     */
    refilter() {
      const { anisotropy } = options.quality();
      for (const slot of slots.values()) {
        const texture = slot.texture;
        if (!texture || texture.anisotropy === anisotropy) continue;
        texture.anisotropy = anisotropy;
        texture.needsUpdate = true;
      }
    },
    /** Starts once, after the first frame, when the browser is idle. */
    start() {
      if (ready) return;
      /* Safari has no idle callback. */
      const idle =
        "requestIdleCallback" in window && typeof window.requestIdleCallback === "function"
          ? window.requestIdleCallback.bind(window)
          : undefined;
      const go = () => {
        ready = true;
        options.wake();
      };
      if (idle) idle.call(window, go);
      else setTimeout(go, 300);
    },
    /** Each frame, after the layers reported their sizes; `keep` is the body in close-up. */
    update(dt: number, need: ReadonlyMap<BodyId, number>, keep: BodyId | null) {
      clock += dt;
      if (!ready) return;
      let next: BodyId | null = null;
      let nextPx = LOAD_PX;
      for (const [id, px] of need) {
        const slot = slots.get(id);
        if (slot) {
          if (px >= IDLE_PX) slot.seen = clock;
          continue;
        }
        if (px >= nextPx && MAPS[id]) {
          next = id;
          nextPx = px;
        }
      }
      if (keep) {
        const slot = slots.get(keep);
        if (slot) slot.seen = clock;
        else if (MAPS[keep] && !next) next = keep;
      }
      if (next && !loading) {
        const file = tierFile(MAP_BASE, next, "far");
        if (file) load(next, file);
      }
      trim(keep);
    },
  };
}
