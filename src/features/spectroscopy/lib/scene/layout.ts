/** Where the scene's parts sit on a stage `width` × `height` CSS px: a bench or a star's limb. */
export type Geometry = {
  midY: number;
  star: { x: number; y: number; r: number };
  source: { x: number; y: number };
  gas: { x: number; w: number };
  airBand: { x: number; w: number };
  slit: { x: number; y: number };
  grating: { x: number; y: number };
};

export function layout(kind: "slab" | "star", width: number, height: number): Geometry {
  const midY = height * 0.5;
  const star = { x: -height * 0.55, y: midY, r: Math.max(height * 0.95, 60) };
  const source = kind === "slab" ? { x: width * 0.1, y: midY } : { x: star.x + star.r, y: midY };
  const gas =
    kind === "slab"
      ? { x: width * 0.36, w: Math.max(18, width * 0.06) }
      : { x: star.x + star.r * 1.04, w: Math.max(6, star.r * 0.05) };
  const slit = { x: width * 0.84, y: midY };
  return {
    midY,
    star,
    source,
    gas,
    airBand: { x: width * 0.6, w: Math.max(10, width * 0.035) },
    slit,
    grating: { x: slit.x + 22, y: midY },
  };
}
