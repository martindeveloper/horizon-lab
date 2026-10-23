/**
 * A resizable dialog's size: dragged by an edge or a corner it stays centred, so an edge moves
 * half the size change; it never grows past the screen less a margin, nor shrinks below a
 * readable minimum.
 */
export type DialogSize = { width: number; height: number };

/** The smallest a dialog is dragged to, px (or the screen less its margin, if smaller). */
export const DIALOG_MIN: DialogSize = { width: 320, height: 240 };

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** The margin a filling dialog keeps from the screen's edges, px: 4 % of its width, 16 to 40 px. */
export const fillMargin = (viewportWidth: number) => clamp(viewportWidth * 0.04, 16, 40);

/** The screen less its margin all round. */
export function fillSize(viewportWidth: number, viewportHeight: number): DialogSize {
  const margin = fillMargin(viewportWidth);
  return { width: viewportWidth - 2 * margin, height: viewportHeight - 2 * margin };
}

/**
 * `start` dragged by `dx`, `dy` px on the edges `ex`, `ey` (−1 the left or top, 1 the right or
 * bottom, 0 neither); centred, so it grows twice the drag.
 */
export function resizedBy(
  start: DialogSize,
  dx: number,
  dy: number,
  ex: -1 | 0 | 1,
  ey: -1 | 0 | 1,
  viewportWidth: number,
  viewportHeight: number,
): DialogSize {
  const most = fillSize(viewportWidth, viewportHeight);
  return {
    width: clamp(start.width + 2 * ex * dx, Math.min(DIALOG_MIN.width, most.width), most.width),
    height: clamp(
      start.height + 2 * ey * dy,
      Math.min(DIALOG_MIN.height, most.height),
      most.height,
    ),
  };
}
