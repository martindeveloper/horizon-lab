import { CDN_URL } from "@/config";

/**
 * Bucket folder of the measured maps' WebP tiers, mirrored locally in `cdn/` for the
 * map builds and tests. Never overwrite a published set: a rebuild takes the next version.
 */
export const MAPS_KEY = "/textures/orrery/v1";

/** Origin to preconnect to, anonymously: assets load with CORS. */
export const assetOrigin = new URL(CDN_URL).origin;

/**
 * URL for a CDN asset by its bucket key, e.g. `/audio/x.webm`. The bucket sends
 * CORS headers: audio runs through Web Audio and maps are fetched into WebGL.
 */
export function assetUrl(path: string) {
  return `${CDN_URL}${path}`;
}
