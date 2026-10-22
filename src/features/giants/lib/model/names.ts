/**
 * Where a rung's name is written: the shared copy's `names.<id>` for a catalogued body (the
 * same words every lab uses), the lab's own `rungs.<id>.name` for a rung that stands for a kind.
 */
import type { RungId } from "./rungs";

/** Rungs that stand for a kind of body rather than one catalogued object. */
const OWN_NAMES: ReadonlySet<RungId> = new Set(["neutron-star"]);
/** Rungs drawn as a catalogued body of another id. */
const CATALOGUED_AS: Partial<Record<RungId, string>> = { "brown-dwarf": "lhs-6343-c" };

/** The message key of a rung's name. */
export const rungNameKey = (id: RungId) =>
  OWN_NAMES.has(id) ? `rungs.${id}.name` : `names.${CATALOGUED_AS[id] ?? id}`;
