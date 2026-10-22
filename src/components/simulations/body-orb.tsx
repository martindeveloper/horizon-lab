import { MAPS, type BodyId } from "@horizon/toolkit/bodies";
import { Orb } from "@horizon/toolkit/ui";

/** An icon standing for a made thing (a spacecraft, an observatory) in an orb's place in a list. */
export const GLYPH_ICON = "size-3.5 text-fg-tertiary";

/**
 * A solar-system body's mark in a list: the Sun shining in the solar gold, any other body lit in
 * its measured map's mean colour (a neutral one where its map is painted: Venus's cloud tops,
 * Sedna, Halley).
 */
export function BodyOrb({ id, size }: { id: BodyId; size?: number }) {
  return id === "sun" ? (
    <Orb look="glow" color="var(--color-solar)" size={size} />
  ) : (
    <Orb color={MAPS[id]?.mean} size={size} />
  );
}
