/**
 * How much work a simulation's frames may take, the same four steps everywhere: `economy`
 * spares the device, `standard` is each simulation's default, `cinema` spends more for a
 * sharper picture, `max` lifts the simulation's device caps and spends all it can. What each
 * step changes is the simulation's own.
 */
export const RENDER_QUALITIES = ["economy", "standard", "cinema", "max"] as const;
export type RenderQuality = (typeof RENDER_QUALITIES)[number];
