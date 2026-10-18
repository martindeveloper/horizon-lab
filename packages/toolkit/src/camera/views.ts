/** Framed views on a log zoom: the one a camera distance is nearest, and whether it is at it. */

/** The view whose distance is nearest `distance`, in log space; the first on a tie. */
export function nearestView<V>(
  views: readonly V[],
  distanceOf: (view: V) => number,
  distance: number,
) {
  const d = Math.max(1e-12, distance);
  let best = views[0];
  let bestGap = Infinity;
  for (const view of views) {
    const gap = Math.abs(Math.log(d / distanceOf(view)));
    if (gap < bestGap) {
      bestGap = gap;
      best = view;
    }
  }
  if (best === undefined) throw new Error("No views to choose from");
  return best;
}

/** True while `distance` is still at a view's scale (within a quarter e-fold), not zoomed elsewhere. */
export const atViewScale = (distance: number, viewDistance: number) =>
  Math.abs(Math.log(Math.max(1e-12, distance) / viewDistance)) < 0.25;
