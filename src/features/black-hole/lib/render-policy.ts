/** Keep the same horizontal framing on portrait screens, matching the toolkit ray-scale convention. */
export function framedRayFov(base: number, aspect: number) {
  return 2 * Math.atan((2 * Math.tan(base / 2)) / Math.min(1, Math.max(0.1, aspect)));
}
