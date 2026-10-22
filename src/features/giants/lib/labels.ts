import type { Vector2 } from "three";

import type { Placed, Stage } from "./model/ladder";
import { namesEnd } from "./model/overview";
import { RUNG_IDS } from "./model/rungs";
import {
  ORBIT_IDS,
  ORBIT_LABEL_MIN_PX,
  ORBIT_LABEL_GAP_PX,
  OVERVIEW_LABEL_GAP_PX,
  PAIR_MARKER_PX,
} from "./parameters";

/** Places body and orbit names, keeping unchanged frames from rewriting the DOM. */
export function createGiantsLabels(labels: HTMLElement) {
  const labelOf = (index: number) =>
    labels.querySelector<HTMLElement>(`[data-rung="${RUNG_IDS[index]}"]`);
  const labelEls = RUNG_IDS.map((_, index) => labelOf(index));
  const marker = labels.querySelector<HTMLElement>("[data-pair-marker]");
  const orbitEls = ORBIT_IDS.map((id) => labels.querySelector<HTMLElement>(`[data-orbit="${id}"]`));
  /** Each label's last transform, so a settled frame writes no style (the DOM normalises what it reads back). */
  const transforms = new WeakMap<HTMLElement, string>();
  function moveLabel(el: HTMLElement, x: number, y: number, anchor: string) {
    const transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) ${anchor}`;
    if (transforms.get(el) === transform) return;
    transforms.set(el, transform);
    el.style.transform = transform;
  }
  /**
   * Each orbit's name on its ring, like a contour's on a map: Mercury's, Earth's and Jupiter's
   * on top, the others' below, so neighbours stand twice as far apart. A ring too small to
   * name, or a name too close to the last one named on its side, is left out.
   */
  function moveOrbitLabels(x: number, y: number, rings: readonly Vector2[], stage: Stage) {
    const named = [-Infinity, -Infinity];
    orbitEls.forEach((el, k) => {
      if (!el) return;
      const { x: r, y: shown } = rings[k]!;
      const side = k % 2;
      const at = side === 0 ? y - r : y + r;
      const inside = x > 8 && x < stage.width - 8 && at > 60 && at < stage.height;
      const on =
        shown > 0 && r > ORBIT_LABEL_MIN_PX && r - named[side]! >= ORBIT_LABEL_GAP_PX && inside;
      if (on) {
        named[side] = r;
        moveLabel(el, x, at, "translate(-50%, -50%)");
      }
      /* Each name comes and goes with its ring. */
      const opacity = on ? shown.toFixed(3) : "0";
      if (el.style.opacity !== opacity) el.style.opacity = opacity;
      if ((el.dataset.shown === "true") !== on) el.dataset.shown = on ? "true" : "false";
    });
  }

  /** Each rung's name shown this frame (1) or not (0). */
  const named = new Uint8Array(RUNG_IDS.length);
  /**
   * The bodies' names: over each body large enough to name on the ladder, in the overview's
   * column with a leader to every dot, and none while the bodies glide between.
   */
  function moveLabels({
    focus,
    stage,
    overviewLevel,
    dotsShown,
    placed,
    placedCount,
    onStage,
    small,
  }: {
    focus: number;
    stage: Stage;
    overviewLevel: number;
    dotsShown: readonly Placed[];
    placed: readonly Placed[];
    placedCount: number;
    onStage: (index: number) => boolean;
    small: Placed | null;
  }) {
    named.fill(0);
    if (overviewLevel >= 1)
      dotsShown.forEach((dot) => {
        const end = namesEnd(stage);
        nameAt(dot, focus, end, dot.y, "translate(-100%, -50%)");
        const el = labelEls[dot.index];
        if (el) lead(el, dot.x - dot.radius - OVERVIEW_LABEL_GAP_PX - end);
      });
    else if (overviewLevel <= 0)
      for (let i = 0; i < placedCount; i++) {
        const body = placed[i]!;
        if (body.index !== focus && body.radius < 9 && !onStage(body.index)) continue;
        const top = Math.max(56, body.y - body.polar - 10);
        nameAt(body, focus, body.x, top, "translate(-50%, -100%)");
      }
    labelEls.forEach((el, index) => {
      if (!el) return;
      const on = named[index] === 1;
      if ((el.dataset.shown === "true") !== on) el.dataset.shown = on ? "true" : "false";
    });
    markSmaller(small);
  }
  /** Side by side, the smaller body keeps a ring round it while it is too small to see. */
  function markSmaller(small: Placed | null) {
    if (!marker) return;
    const on = small !== null && small.radius < PAIR_MARKER_PX;
    if (small && on) moveLabel(marker, small.x, small.y, "translate(-50%, -50%)");
    if ((marker.dataset.shown === "true") !== on) marker.dataset.shown = on ? "true" : "false";
  }
  /** Each name's leader to its dot, CSS px, as last written. */
  const leaders = new WeakMap<HTMLElement, number>();
  /** A name's leader along its row to its dot, `length` CSS px (the stylesheet draws it in the overview). */
  function lead(el: HTMLElement, length: number) {
    const px = Math.max(0, Math.round(length));
    if (leaders.get(el) === px) return;
    leaders.set(el, px);
    el.style.setProperty("--leader", `${px}px`);
  }
  /** A body's name at a stage point, anchored there by `anchor`, marked if it is in focus. */
  function nameAt(body: Placed, focus: number, x: number, y: number, anchor: string) {
    const el = labelEls[body.index];
    if (!el) return;
    named[body.index] = 1;
    moveLabel(el, x, y, anchor);
    const focused = body.index === focus;
    if ((el.dataset.focus === "true") !== focused) el.dataset.focus = focused ? "true" : "false";
  }

  return {
    moveLabels,
    moveOrbitLabels,
    hover(was: number | null, index: number | null) {
      if (was !== null) labelEls[was]?.removeAttribute("data-hover");
      if (index !== null) labelEls[index]?.setAttribute("data-hover", "");
    },
  };
}
