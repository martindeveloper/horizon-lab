/** Large static assets live in the `horizon-cdn` R2 bucket; `NEXT_PUBLIC_ASSETS_URL` overrides it. */
const base = (
  process.env.NEXT_PUBLIC_ASSETS_URL || "https://horizon-cdn.martinpernica.xyz"
).replace(/\/+$/, "");

/**
 * URL for a CDN asset by its bucket key, e.g. `/audio/x.webm`. The bucket sends
 * CORS headers: audio runs through Web Audio.
 */
export function assetUrl(path: string) {
  return `${base}${path}`;
}
