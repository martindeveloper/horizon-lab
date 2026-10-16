/**
 * Immersive view state: the stage covers the window, chrome and overlays step
 * aside, and the scene keeps running untouched. One flag per page, because a
 * page shows one stage at a time. Fullscreen is an optional layer on top.
 */

type Listener = () => void;

let active = false;
let returnFocus = false;
const listeners = new Set<Listener>();

export function subscribeImmersive(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const isImmersive = () => active;

export function setImmersive(next: boolean) {
  if (active === next) return;
  active = next;
  for (const listener of listeners) listener();
}

/** Remembers that the exit control held focus, so the entry control can take it back. */
export function markFocusReturn(value = true) {
  returnFocus = value;
}

export function takeFocusReturn() {
  const value = returnFocus;
  returnFocus = false;
  return value;
}

export const IMMERSIVE_SHORTCUT = "F";

type KeyLike = Pick<
  KeyboardEvent,
  "key" | "repeat" | "altKey" | "ctrlKey" | "metaKey" | "defaultPrevented" | "target"
>;

function typing(target: EventTarget | null) {
  if (target === null || typeof target !== "object" || !("closest" in target)) return false;
  const closest: unknown = target.closest;
  if (typeof closest !== "function") return false;
  return closest.call(target, "input, textarea, select, [contenteditable]") !== null;
}

/** F toggles immersive view and Escape leaves it; typing, chords and auto-repeat are ignored. */
export function immersiveKeyAction(event: KeyLike, immersive: boolean): "toggle" | "exit" | null {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return null;
  if (event.key === "Escape") return immersive ? "exit" : null;
  if (event.repeat || typing(event.target)) return null;
  return event.key.toUpperCase() === IMMERSIVE_SHORTCUT ? "toggle" : null;
}

/** Fullscreen API on one element. iPhone Safari reports `fullscreenEnabled` false or leaves it out. */
export function fullscreenAvailable(doc: Pick<Document, "fullscreenEnabled"> | undefined) {
  return doc?.fullscreenEnabled === true;
}

export function enterFullscreen(element: Element) {
  return element.requestFullscreen({ navigationUI: "hide" }).then(
    () => true,
    () => false,
  );
}

export function exitFullscreen(element: Element) {
  const doc = element.ownerDocument;
  if (doc.fullscreenElement !== element) return Promise.resolve();
  return doc.exitFullscreen().catch(() => {});
}
