/** Controls the arrows move within: a caret, a value, a choice in a group or list. */
const ARROW_CONTROLS = [
  "input",
  "select",
  "textarea",
  "[contenteditable='']",
  "[contenteditable='true']",
  "[role=listbox]",
  "[role=menuitem]",
  "[role=option]",
  "[role=radio]",
  "[role=slider]",
  "[role=tab]",
].join(",");

/** Elements that own their keys: Space activates, arrows step, Escape closes. */
const CONTROLS = [
  ARROW_CONTROLS,
  "a[href]",
  "button",
  "summary",
  "[role=button]",
  "[role=checkbox]",
  "[role=link]",
  "[role=switch]",
].join(",");

/**
 * Whether a window-level scene shortcut may act on this key event. It may not
 * when a modifier is held (browser and assistive shortcuts), during IME
 * composition, when something already handled the key, or inside an open
 * dialog. With `controls: false` (the default) it also stands aside while a
 * focused control would use the key itself, so Space still presses buttons
 * and arrows still move sliders. With `controls: "buttons"` it acts from a
 * focused button or link too, which the arrows do not move, and stands aside
 * only for the controls they do. `controls: true` acts from any control.
 */
export function isSceneShortcut(
  event: KeyboardEvent,
  { controls = false }: { controls?: boolean | "buttons" } = {},
) {
  if (event.defaultPrevented || event.isComposing) return false;
  if (event.altKey || event.ctrlKey || event.metaKey) return false;
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return true;
  if (target.closest("dialog[open]")) return false;
  switch (controls) {
    case true:
      return true;
    case "buttons":
      return !target.closest(ARROW_CONTROLS);
    default:
      return !target.closest(CONTROLS);
  }
}
