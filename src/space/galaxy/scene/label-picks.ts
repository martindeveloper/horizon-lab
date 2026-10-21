/**
 * What a tap on a label opens, by the label's key. Each layer registers the keys it places;
 * picking asks the registry, so the engine chains nothing. A key no layer owns opens nothing.
 */
import type { WorldSelection as Selection } from "../show";

export type LabelPick = (key: string) => Selection | undefined;

export type LabelPicks = ReturnType<typeof createLabelPicks>;

export function createLabelPicks() {
  const picks: LabelPick[] = [];
  return {
    /** A layer's picks: a function for keys it derives, or a map of the keys it places. */
    register(pick: LabelPick | ReadonlyMap<string, Selection>) {
      picks.push(typeof pick === "function" ? pick : (key) => pick.get(key));
    },
    /** What the label `key` opens, asking the layers in the order they registered. */
    pick(key: string): Selection | undefined {
      for (const pick of picks) {
        const selection = pick(key);
        if (selection !== undefined) return selection;
      }
      return undefined;
    },
  };
}
