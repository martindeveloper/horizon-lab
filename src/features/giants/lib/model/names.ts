import { rungById, type RungId } from "./rungs";

/** Generic teaching examples keep their own name; named bodies use the shared catalogue identity. */
export function rungNameKey(id: RungId) {
  const rung = rungById(id);
  return rung.ownName ? `rungs.${id}.name` : `names.${rung.body.id}`;
}
