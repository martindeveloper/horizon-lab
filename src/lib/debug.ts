import { DEBUG } from "@/config";
import type { WebGLSupport } from "@horizon/toolkit/rendering";
import { numbers, oneOf, storageCell } from "@horizon/toolkit/storage";

/**
 * Developer overrides driven from the browser console (`Horizon.Debug`).
 * Nothing here runs unless someone calls it; without overrides the app is unchanged.
 * Without `DEBUG` stored overrides are ignored, so none outlives the tools.
 */
export type CrashScope = "route" | "root";

const listeners = new Set<() => void>();
const crashListeners = new Map<CrashScope, Set<() => void>>();

const webglCell = storageCell({
  key: "horizon:debug:webgl",
  codec: oneOf("ready", "software", "unavailable"),
});

/** The forced WebGL result for this tab, kept across reloads. */
export function webglOverride(): WebGLSupport | null {
  return DEBUG ? webglCell.get() : null;
}

export function setWebGLOverride(value: WebGLSupport | null) {
  if (value) webglCell.set(value);
  else webglCell.clear();
  for (const listener of listeners) listener();
}

export function subscribeDebug(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Ask every mounted crash trigger of this scope to throw on its next render. */
export function triggerCrash(scope: CrashScope) {
  const targets = crashListeners.get(scope);
  for (const listener of targets ?? []) listener();
  return (targets?.size ?? 0) > 0;
}

export function onCrash(scope: CrashScope, listener: () => void) {
  const targets = crashListeners.get(scope) ?? new Set();
  crashListeners.set(scope, targets);
  targets.add(listener);
  return () => void targets.delete(listener);
}

const noticeListeners = new Set<() => void>();

/** Show the phone notice now, on any device and even after dismissal. */
export function showDesktopNotice() {
  for (const listener of noticeListeners) listener();
  return noticeListeners.size > 0;
}

export function onDesktopNotice(listener: () => void) {
  noticeListeners.add(listener);
  return () => void noticeListeners.delete(listener);
}

/** Sky time = `sky` + (wall time − `wall`) × `scale`, in milliseconds. */
const skyCell = storageCell({
  key: "horizon:debug:sky",
  codec: numbers("sky", "wall", "scale"),
});

function saveSky(next: { sky: number; wall: number; scale: number } | null) {
  if (next) skyCell.set(next);
  else skyCell.clear();
  for (const listener of listeners) listener();
}

const skyClock = () => (DEBUG ? skyCell.get() : null);

/** The time the hero, the star field and the sidereal clock show, in ms: wall time unless overridden. */
export function skyNow(wall = Date.now()) {
  const clock = skyClock();
  return clock ? clock.sky + (wall - clock.wall) * clock.scale : wall;
}

/** Sky seconds per wall second; 1 without an override. */
export function skyTimeScale() {
  return skyClock()?.scale ?? 1;
}

/** True when the sky moves faster or slower than a minute-by-minute redraw can show. */
export function skyRunsFast() {
  const scale = skyTimeScale();
  return scale !== 1 && scale !== 0;
}

/** Show the sky at `ms` (null: the real time), keeping the current time scale. */
export function setSkyTime(ms: number | null) {
  const scale = skyTimeScale();
  const wall = Date.now();
  saveSky(ms === null && scale === 1 ? null : { sky: ms ?? wall, wall, scale });
}

/** Run the sky `scale` times faster from where it is now (1: real speed, 0: frozen). */
export function setSkyTimeScale(scale: number) {
  const wall = Date.now();
  const at = skyNow(wall);
  saveSky(scale === 1 && Math.abs(at - wall) < 1000 ? null : { sky: at, wall, scale });
}
