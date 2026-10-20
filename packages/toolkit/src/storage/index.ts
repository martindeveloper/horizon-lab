/**
 * One value in sessionStorage or localStorage.
 * Importing this module touches no browser globals; a cell reads storage when called.
 */
import type { StorageCodec } from "./codecs";

export { flag, json, numbers, oneOf, text, type StorageCodec } from "./codecs";

export type StorageArea = "session" | "local";

export type StorageCell<T> = {
  /** The stored value, or null when it is missing or fully decayed. */
  get(now?: number): T | null;
  /**
   * 1 through the lifetime, then a linear fall to 0 across the decay.
   * 0 when the value is missing. A fully decayed value is removed.
   */
  freshness(now?: number): number;
  set(value: T, now?: number): void;
  clear(): void;
};

export type StorageCellOptions<T> = {
  key: string;
  /** Defaults to session: this tab, including reloads. `"local"` lasts until cleared. */
  area?: StorageArea;
  /**
   * Milliseconds the value stays at full strength. Omit it and the value lasts
   * as long as the area does. A decay with no lifetime starts fading at the write.
   */
  lifetime?: number;
  /**
   * Milliseconds after the lifetime during which freshness falls from 1 to 0.
   * The value is then removed. Omit it and the value ends in one step.
   */
  decay?: number;
  codec: StorageCodec<T>;
};

type State<T> = { loaded: boolean; value: T | null; at: number };

const localWatchers = new Map<string, Set<() => void>>();
let localListening = false;

function watchLocal(key: string, invalidate: () => void) {
  if (typeof window === "undefined") return;
  let watchers = localWatchers.get(key);
  if (!watchers) localWatchers.set(key, (watchers = new Set()));
  watchers.add(invalidate);
  if (localListening) return;
  localListening = true;
  window.addEventListener("storage", (event) => {
    let local: Storage | null;
    try {
      local = globalThis.localStorage ?? null;
    } catch {
      return;
    }
    if (!local || event.storageArea !== local) return;
    if (event.key === null) {
      for (const group of localWatchers.values()) for (const fn of group) fn();
      return;
    }
    const group = localWatchers.get(event.key);
    if (group) for (const fn of group) fn();
  });
}

function open(area: StorageArea): Storage | null {
  try {
    return (area === "local" ? globalThis.localStorage : globalThis.sessionStorage) ?? null;
  } catch {
    return null;
  }
}

function clock(now: number | undefined) {
  const at = now === undefined ? Date.now() : now;
  if (!Number.isFinite(at)) throw new TypeError("Expected a finite timestamp");
  return Math.trunc(at);
}

function weight(age: number, lifetime: number, decay: number | undefined) {
  if (age <= lifetime) return 1;
  if (decay === undefined || decay <= 0) return 0;
  const t = (age - lifetime) / decay;
  return t >= 1 ? 0 : 1 - t;
}

function checkSpan(name: string, value: number | undefined) {
  if (value !== undefined && (!Number.isFinite(value) || value < 0))
    throw new TypeError(`Expected a non-negative ${name}`);
}

/**
 * A named place in web storage.
 *
 * The decoded value is kept in memory, so a later read does not parse again
 * and does not ask the store. Writes encode once. A missing or blocked store
 * does not throw: the value still lives for this page, and is forgotten on reload.
 * A local cell picks up another tab's write on the next read.
 */
export function storageCell<T>(options: StorageCellOptions<T>): StorageCell<T> {
  const key = options.key;
  if (key === "") throw new TypeError("Expected a storage key");
  checkSpan("lifetime", options.lifetime);
  checkSpan("decay", options.decay);
  const area = options.area ?? "session";
  const lifetime = options.lifetime ?? (options.decay === undefined ? undefined : 0);
  const decay = options.decay;
  const permanent = lifetime === undefined;
  const codec = options.codec;
  const state: State<T> = { loaded: false, value: null, at: 0 };

  /** The cell holds no value; `loaded` says whether the store was asked. */
  function reset(loaded: boolean) {
    state.loaded = loaded;
    state.value = null;
    state.at = 0;
  }

  function write(raw: string | null) {
    try {
      const store = open(area);
      if (!store) return;
      if (raw === null) store.removeItem(key);
      else store.setItem(key, raw);
    } catch {
      /* Blocked storage keeps the value for this page and loses it on reload. */
    }
  }

  function unpack(raw: string): { value: T; at: number } | null {
    if (permanent) {
      const value = codec.decode(raw);
      return value === null ? null : { value, at: 0 };
    }
    const cut = raw.indexOf("\n");
    if (cut <= 0) return null;
    const at = Number.parseInt(raw.slice(0, cut), 36);
    if (!Number.isFinite(at)) return null;
    const value = codec.decode(raw.slice(cut + 1));
    return value === null ? null : { value, at };
  }

  function load() {
    if (state.loaded) return;
    let raw: string | null;
    try {
      const store = open(area);
      if (!store) {
        reset(true);
        return;
      }
      raw = store.getItem(key);
    } catch {
      return;
    }
    const parsed = raw === null ? null : unpack(raw);
    if (!parsed) {
      reset(true);
      if (raw !== null) write(null);
      return;
    }
    state.loaded = true;
    state.value = parsed.value;
    state.at = parsed.at;
  }

  function drop() {
    reset(true);
    write(null);
  }

  /** Null when the value is absent or its strength has reached 0. */
  function current(now: number | undefined): T | null {
    load();
    if (state.value === null) return null;
    if (permanent) return state.value;
    if (weight(clock(now) - state.at, lifetime, decay) === 0) {
      drop();
      return null;
    }
    return state.value;
  }

  /* Cells live as long as the page (see the README), so the watcher is never removed. */
  if (area === "local") watchLocal(key, () => reset(false));

  return {
    get: (now) => current(now),
    freshness(now) {
      load();
      if (state.value === null) return 0;
      if (permanent) return 1;
      const strength = weight(clock(now) - state.at, lifetime, decay);
      if (strength === 0) {
        drop();
        return 0;
      }
      return strength;
    },
    set(value, now) {
      const payload = codec.encode(value);
      if (payload === "") {
        drop();
        return;
      }
      // Round-trip so the cache is the stored value, not the caller's object.
      const stored = codec.decode(payload);
      if (stored === null) throw new TypeError("Codec rejected its own encoding");
      const at = permanent ? 0 : clock(now);
      state.loaded = true;
      state.value = stored;
      state.at = at;
      write(permanent ? payload : `${at.toString(36)}\n${payload}`);
    },
    clear: drop,
  };
}
