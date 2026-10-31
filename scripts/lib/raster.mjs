import sharp from "sharp";

/**
 * An equirectangular source read at `width` × `width / 2` as floats, `channels` per texel (1:
 * grey, 3: sRGB), each 8-bit value through `decode` (by default to 0–1, still sRGB-encoded).
 * A source centred on 0° is rolled half a width, so every map starts at 0° east on the left.
 */
export async function raster(file, width, channels, centredOnZero, decode = (byte) => byte / 255) {
  const h = width / 2;
  const { data, info } = await sharp(file, { limitInputPixels: false, unlimited: true })
    .resize(width, h, { fit: "fill", kernel: "lanczos3" })
    .toColourspace(channels === 1 ? "b-w" : "srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  const shift = centredOnZero ? width / 2 : 0;
  const out = new Float32Array(width * h * channels);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < width; x += 1) {
      for (let c = 0; c < channels; c += 1) {
        out[(y * width + x) * channels + c] = decode(
          data[(y * width + ((x + shift) % width)) * info.channels + c],
        );
      }
    }
  }
  return out;
}
