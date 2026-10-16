/** Elements that own their keys: Space activates, arrows step, Escape closes. */
const CONTROLS = [
  "a[href]",
  "button",
  "input",
  "select",
  "summary",
  "textarea",
  "[contenteditable='']",
  "[contenteditable='true']",
  "[role=button]",
  "[role=checkbox]",
  "[role=link]",
  "[role=listbox]",
  "[role=menuitem]",
  "[role=option]",
  "[role=radio]",
  "[role=slider]",
  "[role=switch]",
  "[role=tab]",
].join(",");

/**
 * Whether a window-level scene shortcut may act on this key event. It may not
 * when a modifier is held (browser and assistive shortcuts), during IME
 * composition, when something already handled the key, or inside an open
 * dialog. With `controls: false` (the default) it also stands aside while a
 * focused control would use the key itself, so Space still presses buttons
 * and arrows still move sliders.
 */
export function isSceneShortcut(event: KeyboardEvent, { controls = false } = {}) {
  if (event.defaultPrevented || event.isComposing) return false;
  if (event.altKey || event.ctrlKey || event.metaKey) return false;
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return true;
  if (target.closest("dialog[open]")) return false;
  return controls || !target.closest(CONTROLS);
}
