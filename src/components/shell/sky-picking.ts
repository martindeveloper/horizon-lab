import type { Star } from "@/space/star-catalogue";

export type PlacedStar = { star: Star; x: number; y: number };

/** Pick in the star layer's coordinates; lower magnitudes win exact distance ties. */
export function nearestStar(
  stars: readonly PlacedStar[],
  x: number,
  y: number,
  radius: number,
): PlacedStar | undefined {
  let nearest: PlacedStar | undefined;
  let nearestDistanceSquared = radius * radius;

  for (const candidate of stars) {
    const distanceSquared = (candidate.x - x) ** 2 + (candidate.y - y) ** 2;
    if (distanceSquared > nearestDistanceSquared) continue;
    if (
      !nearest ||
      distanceSquared < nearestDistanceSquared ||
      candidate.star[3] < nearest.star[3]
    ) {
      nearest = candidate;
      nearestDistanceSquared = distanceSquared;
    }
  }

  return nearest;
}
