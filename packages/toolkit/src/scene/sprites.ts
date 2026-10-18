/** Small painted textures and the point and sprite materials built on them. */
import {
  AdditiveBlending,
  CanvasTexture,
  NormalBlending,
  PointsMaterial,
  SpriteMaterial,
  SRGBColorSpace,
  type Texture,
} from "three";

function canvas2d(size: number) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D canvas unavailable");
  return { canvas, g };
}

/** A 128 px radial gradient: `[t, css colour]` stops from the centre out. */
export function radialSprite(stops: readonly (readonly [number, string])[]) {
  const { canvas, g } = canvas2d(128);
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [t, color] of stops) grd.addColorStop(t, color);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** A soft white disc for points. */
export function softCircle() {
  const { canvas, g } = canvas2d(32);
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.45, "rgba(255,255,255,0.7)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  return new CanvasTexture(canvas);
}

/** The warm glow of stars and galaxies seen whole. */
export const glowSprite = () =>
  radialSprite([
    [0, "rgba(255,244,220,0.95)"],
    [0.2, "rgba(255,214,140,0.35)"],
    [0.5, "rgba(224,162,58,0.08)"],
    [1, "rgba(224,162,58,0)"],
  ]);

/** A camera-facing sprite: `additive` glows, otherwise it covers. */
export const spriteMaterial = (map: Texture, color: string, opacity: number, additive: boolean) =>
  new SpriteMaterial({
    map,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
    blending: additive ? AdditiveBlending : NormalBlending,
  });

/** Vertex-coloured points a steady `size` CSS px across at any distance. */
export const pointsMaterial = (map: Texture, size: number, opacity: number, additive: boolean) =>
  new PointsMaterial({
    map,
    vertexColors: true,
    size,
    sizeAttenuation: false,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
    blending: additive ? AdditiveBlending : NormalBlending,
  });
