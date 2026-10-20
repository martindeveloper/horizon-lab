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

function canvas2d(width: number, height = width) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D canvas unavailable");
  return { canvas, g };
}

/** RGBA, 0–255, of the texel at `u`, `v` (0..1 from the top left). */
export type TexelPainter = (u: number, v: number) => readonly [number, number, number, number];

/** A `width` × `height` sRGB texture painted texel by texel. */
export function paintedTexture(width: number, height: number, texel: TexelPainter) {
  const { canvas, g } = canvas2d(width, height);
  const img = g.createImageData(width, height);
  const data = img.data;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const px = texel(x / width, y / height);
      const i = (y * width + x) * 4;
      data[i] = px[0];
      data[i + 1] = px[1];
      data[i + 2] = px[2];
      data[i + 3] = px[3];
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
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
  /* Every texel is white and only the alpha varies, so there is no colour to decode. */
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
