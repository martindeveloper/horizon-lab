/**
 * Texture streaming for a scene that flies up to the bodies: every tier of the measured maps
 * (`MAPS`) loads by need. Each frame the layers report how large each globe is in device
 * pixels; a body a few pixels across gets its far map, and as it grows the tier that keeps a
 * texel per pixel (`tierFor`), up to what the quality allows. Loads go one at a time, far
 * maps first so something measured shows soon, then the body in most need. Decoded maps wait
 * for an upload slot, so a swap never stalls a frame mid-flight: one per `UPLOAD_GAP_S`
 * unless the scene says it is cruising, the budget waking the scene when the slot opens. Over the memory budget, the maps of bodies that have
 * stayed small the longest are released, close-up tiers first; at most one `near` and one
 * `nearLight` map stay resident, the body being flown by and the next. A failed far map
 * leaves its body painted; a failed close-up tier leaves the far map showing.
 */
import type { Texture } from "three";

import { TIERS, bytesOf, tierFor, tierRank } from "@/space/solar-system/graphics/map-tiers";
import { MAPS, tierFile, type BodyId, type MapTier } from "@horizon/toolkit/bodies";
import type { DisposalScope } from "@horizon/toolkit/rendering";
import { decodeMap, fetchMap } from "@horizon/toolkit/scene";

/** On-screen radius (device px) that asks for a body's far map. */
const LOAD_PX = 3;
/** Below this radius a measured map shows nothing a painted one does not. */
const IDLE_PX = 1;
/** Below this radius a close-up tier shows nothing the far map does not. */
const NEAR_IDLE_PX = 120;
/** Seconds a map must stay idle before the budget may release it. */
const IDLE_S = 20;
/** Seconds a close-up tier must stay idle before the budget may release it. */
const NEAR_IDLE_S = 10;
/** Seconds between uploads while the scene is not cruising. */
const UPLOAD_GAP_S = 0.5;
/** Prefetched tiers kept as compressed bytes (a few MB at most). */
const PREFETCH_KEEP = 2;

/** What a quality allows the budget: resident bytes, filtering, and the largest tier it may load. */
export type MapBudgetQuality = { budget: number; anisotropy: number; allow: MapTier };

type Slot = {
  id: BodyId;
  tier: MapTier;
  state: "loading" | "decoded" | "ready" | "failed";
  texture: Texture | null;
  bytes: number;
  /** Clock time the body was last large enough for this tier to matter. */
  seen: number;
};

/** Each body's slot keys by tier, written once: the frame loop looks them up, not builds them. */
const KEYS = new Map<BodyId, Map<MapTier, string>>();
const key = (id: BodyId, tier: MapTier) => {
  let keys = KEYS.get(id);
  if (!keys) KEYS.set(id, (keys = new Map(TIERS.map((t) => [t, `${id}:${t}`]))));
  return keys.get(tier)!;
};

export type MapBudget = ReturnType<typeof createMapBudget>;

export function createMapBudget(
  scope: DisposalScope,
  options: {
    /** Where the tiers are served from (`tierFile(base, …)`). */
    base: string;
    quality: () => MapBudgetQuality;
    /** A map is ready: put it on its body (the budget keeps and disposes the texture). */
    onShow: (id: BodyId, texture: Texture, tier: MapTier) => void;
    /** No measured map is resident for the body any more: it goes back to its own face. */
    onRelease: (id: BodyId) => void;
    /** The far map could not load: the body falls back to its painted map. */
    onFail: (id: BodyId) => void;
    /** Uploads a decoded texture now (`renderer.initTexture`), in an upload slot. */
    upload: (texture: Texture) => void;
    /** Asks for a frame, so a load that finished off-screen, or a slot that opened, is shown. */
    wake: () => void;
    /** Seconds on a steady clock, for the upload pacing; `performance.now` by default. */
    now?: () => number;
    /** The loader, for tests; fetches then decodes by default. */
    load?: (file: string, signal: AbortSignal, anisotropy: number) => Promise<Texture>;
  },
) {
  const abort = new AbortController();
  const slots = new Map<string, Slot>();
  /** Compressed bytes fetched ahead, by file. */
  const prefetched = new Map<string, Promise<Blob>>();
  let clock = 0;
  let ready = false;
  let starting = false;
  let loading = false;
  let resident = 0;
  let lastUpload = -Infinity;
  const now = options.now ?? (() => performance.now() / 1000);
  /** The wake asked for when the next upload slot opens. */
  let slotTimer: ReturnType<typeof setTimeout> | undefined;
  scope.defer(() => {
    clearTimeout(slotTimer);
    abort.abort();
    for (const slot of slots.values()) slot.texture?.dispose();
    slots.clear();
    prefetched.clear();
  });

  const bytesFor = (file: string) => {
    let bytes = prefetched.get(file);
    if (!bytes) {
      bytes = fetchMap(file, abort.signal);
      bytes.catch(() => prefetched.delete(file));
      prefetched.set(file, bytes);
      for (const other of prefetched.keys()) {
        if (prefetched.size <= PREFETCH_KEEP) break;
        if (other !== file) prefetched.delete(other);
      }
    }
    return bytes;
  };
  const load =
    options.load ??
    (async (file: string, signal: AbortSignal, anisotropy: number) => {
      const blob = await bytesFor(file);
      signal.throwIfAborted();
      prefetched.delete(file);
      return decodeMap(blob, anisotropy);
    });

  /** The body's largest ready tier, if any. */
  const bestOf = (id: BodyId): Slot | null => {
    let best: Slot | null = null;
    for (const tier of TIERS) {
      const slot = slots.get(key(id, tier));
      if (slot?.state === "ready") best = slot;
    }
    return best;
  };
  /** Shows the body's best ready tier, or gives the body back its own face. */
  const refresh = (id: BodyId) => {
    const best = bestOf(id);
    if (best) options.onShow(id, best.texture!, best.tier);
    else options.onRelease(id);
  };
  const release = (slot: Slot) => {
    slots.delete(key(slot.id, slot.tier));
    if (slot.state === "ready") resident -= slot.bytes;
    slot.texture?.dispose();
    refresh(slot.id);
  };

  const start = (id: BodyId, tier: MapTier) => {
    const file = tierFile(options.base, id, tier);
    if (!file) return;
    const slot: Slot = { id, tier, state: "loading", texture: null, bytes: 0, seen: clock };
    slots.set(key(id, tier), slot);
    loading = true;
    load(file, abort.signal, options.quality().anisotropy).then(
      (texture) => {
        loading = false;
        if (abort.signal.aborted || slots.get(key(id, tier)) !== slot) {
          texture.dispose();
          return;
        }
        slot.state = "decoded";
        slot.texture = texture;
        slot.bytes = bytesOf(MAPS[id]!.widths[tier]);
        options.wake();
      },
      () => {
        loading = false;
        slot.state = "failed";
        if (!abort.signal.aborted && tier === "far") options.onFail(id);
      },
    );
  };

  /** Uploads one decoded map when an upload slot is free; true while any waits. */
  const upload = (cruising: boolean) => {
    let uploaded = false;
    let waiting = false;
    const at = now();
    for (const slot of slots.values()) {
      if (slot.state !== "decoded") continue;
      if (uploaded || (!cruising && at - lastUpload < UPLOAD_GAP_S)) {
        waiting = true;
        continue;
      }
      options.upload(slot.texture!);
      uploaded = true;
      lastUpload = at;
      slot.state = "ready";
      slot.seen = clock;
      resident += slot.bytes;
      /* One close-up map of a tier at a time: the newest wins. */
      if (slot.tier !== "far")
        for (const other of slots.values())
          if (other !== slot && other.tier === slot.tier && other.state === "ready") release(other);
      refresh(slot.id);
    }
    if (waiting && slotTimer === undefined) {
      const left = uploaded ? UPLOAD_GAP_S : UPLOAD_GAP_S - (at - lastUpload);
      slotTimer = setTimeout(
        () => {
          slotTimer = undefined;
          options.wake();
        },
        Math.max(0, left) * 1000,
      );
    }
    return waiting;
  };

  /** Releases the longest-idle maps while over budget, close-up tiers first; `keep`'s stay. */
  const trim = (keep: BodyId | null) => {
    const idle = (slot: Slot) =>
      slot.state === "ready" &&
      slot.id !== keep &&
      clock - slot.seen > (slot.tier === "far" ? IDLE_S : NEAR_IDLE_S);
    while (resident > options.quality().budget) {
      let oldest: Slot | null = null;
      for (const slot of slots.values()) {
        if (!idle(slot)) continue;
        if (
          !oldest ||
          tierRank(slot.tier) > tierRank(oldest.tier) ||
          (slot.tier === oldest.tier && slot.seen < oldest.seen)
        )
          oldest = slot;
      }
      if (!oldest) return;
      release(oldest);
    }
    /* Close-up tiers of bodies that shrank away go even inside the budget. */
    for (const slot of slots.values()) if (slot.tier !== "far" && idle(slot)) release(slot);
  };

  return {
    /** The body's largest resident tier, if any: what the tests read. */
    tierOf: (id: BodyId) => bestOf(id)?.tier ?? null,
    /** Fetches a tier's bytes ahead of its need (a flight's destination); decoding waits for the need. */
    prefetch(id: BodyId, tier: MapTier) {
      const file = tierFile(options.base, id, tier);
      if (file && !slots.has(key(id, tier))) bytesFor(file).catch(() => undefined);
    },
    /** Gives every resident map the current quality's filtering; maps that load later take it as they load. */
    refilter() {
      const { anisotropy } = options.quality();
      for (const slot of slots.values()) {
        const texture = slot.texture;
        if (!texture || texture.anisotropy === anisotropy) continue;
        texture.anisotropy = anisotropy;
        texture.needsUpdate = true;
      }
    },
    /** Starts once, after the first frame, when the browser is idle (`atOnce`: now). */
    start(atOnce = false) {
      if (ready || starting) return;
      starting = true;
      const go = () => {
        if (abort.signal.aborted) return;
        ready = true;
        options.wake();
      };
      if (atOnce) go();
      else if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function")
        window.requestIdleCallback(go);
      else setTimeout(go, 300);
    },
    /**
     * Each frame, after the layers reported their sizes (`need`: on-screen radius in device
     * pixels per body, at the flight's destination where one is under way). `keep` is a body
     * whose maps are never released; `cruising` lifts the upload pacing. True while a decoded
     * map still waits for its upload slot (the budget wakes the scene when it opens).
     */
    update(
      dt: number,
      need: ReadonlyMap<BodyId, number>,
      { keep = null, cruising = false }: { keep?: BodyId | null; cruising?: boolean } = {},
    ) {
      clock += dt;
      if (!ready) return false;
      /* What decoded since last frame shows first, so the need below sees it resident. */
      const waiting = upload(cruising);
      const { allow } = options.quality();
      let next: { id: BodyId; tier: MapTier; px: number } | null = null;
      for (const [id, px] of need) {
        const map = MAPS[id];
        if (!map) continue;
        const best = bestOf(id);
        for (const tier of TIERS) {
          const slot = slots.get(key(id, tier));
          if (slot && px >= (tier === "far" ? IDLE_PX : NEAR_IDLE_PX)) slot.seen = clock;
        }
        if (px < LOAD_PX) continue;
        const want = best ? tierFor(px, map.widths, allow) : "far";
        if (slots.has(key(id, want))) continue;
        if (best && tierRank(want) <= tierRank(best.tier)) continue;
        /* Bodies with no map yet come first, then the largest need. */
        const first = !best;
        if (
          !next ||
          (first && next.tier !== "far") ||
          (first === (next.tier === "far") && px > next.px)
        )
          next = { id, tier: want, px };
      }
      if (keep && !bestOf(keep) && MAPS[keep] && !slots.has(key(keep, "far")) && !next)
        next = { id: keep, tier: "far", px: LOAD_PX };
      if (next && !loading) start(next.id, next.tier);
      trim(keep);
      return waiting;
    },
  };
}
