/**
 * Loads a measured map (`MAPS` in `@horizon/toolkit/bodies`) as a texture. Decoding happens
 * off the main thread through createImageBitmap where the browser allows; the bitmap stays
 * with the texture so a lost WebGL context can upload it again, and is closed when the
 * texture is disposed. The app owns where the tiers are served from (`tierFile(base, …)`).
 */
import {
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
} from "three";

function surface(texture: Texture, anisotropy: number) {
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

async function bitmapTexture(blob: Blob, anisotropy: number) {
  /* An ImageBitmap ignores UNPACK_FLIP_Y, so it is flipped while decoding instead. */
  const bitmap = await createImageBitmap(blob, {
    imageOrientation: "flipY",
    premultiplyAlpha: "none",
    colorSpaceConversion: "none",
  });
  const texture = new Texture(bitmap);
  texture.flipY = false;
  texture.addEventListener("dispose", () => bitmap.close());
  return surface(texture, anisotropy);
}

async function imageTexture(blob: Blob, anisotropy: number) {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return surface(new Texture(image), anisotropy);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The map's compressed bytes: cheap to hold, so a likely close-up can fetch them early. */
export async function fetchMap(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const blob = await response.blob();
  signal.throwIfAborted();
  return blob;
}

/** Decodes fetched bytes into a texture (off the main thread where the browser can). */
export async function decodeMap(blob: Blob, anisotropy = 2) {
  try {
    return await bitmapTexture(blob, anisotropy);
  } catch {
    return imageTexture(blob, anisotropy);
  }
}

export async function loadMap(url: string, signal: AbortSignal, anisotropy = 2) {
  return decodeMap(await fetchMap(url, signal), anisotropy);
}
