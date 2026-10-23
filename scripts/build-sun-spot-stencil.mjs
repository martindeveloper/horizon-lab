/** node --import tsx scripts/build-sun-spot-stencil.mjs
 * Derive the Sun Lab's close-up stencil from the exact published photograph, offline, into the
 * local CDN mirror (cdn/ + `MAPS_KEY`/sun/spots/v<VERSION>/). Requires the mirror (npm run
 * cdn:pull). No network or inferred depth. A rebuild bumps VERSION: never overwrite a published key.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import sharp from "sharp";

import { MAPS, mapFile } from "@horizon/toolkit/bodies";

import { MAPS_KEY } from "../src/lib/assets.ts";
import { SUN_MAP_QUIET_INTENSITY } from "../src/space/solar-system/model/parameters.ts";
import { SRGB_TO_LINEAR } from "./lib/colour.mjs";
import { buildSpotAtlas, STENCIL } from "./lib/sun-spot-stencil.mjs";

const VERSION = 2;
const key = `${MAPS_KEY}/sun/spots/v${VERSION}`;
const sourceFile = mapFile(MAPS_KEY, "sun", "near");
const source = await readFile(new URL(`../cdn${sourceFile}`, import.meta.url));
const sourceSha256 = createHash("sha256").update(source).digest("hex");
// Deliberate source changes must update this pin and regenerate the versioned stencil.
if (sourceSha256 !== "407772081dd901b124a8091ace9b6842e8125e6bda49461187a0ee3401553a69")
  throw new Error(
    "The published Sun photograph changed; review the stencil source before rebuilding",
  );
const { data, info } = await sharp(source)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const intensity = Float32Array.from(
  { length: info.width * info.height },
  (_, i) => SRGB_TO_LINEAR[data[i * info.channels]] / SUN_MAP_QUIET_INTENSITY,
);
const result = buildSpotAtlas(intensity, info.width, info.height, SUN_MAP_QUIET_INTENSITY);
const directory = new URL(`../cdn${key}/`, import.meta.url);
await mkdir(directory, { recursive: true });
for (const { name, pixels, width, height } of [
  { name: "atlas", pixels: result.atlas, width: result.atlasWidth, height: result.atlasHeight },
  { name: "pages", pixels: result.pages, width: result.columns, height: result.rows },
]) {
  await sharp(pixels, { raw: { width, height, channels: 3 } })
    .png({ compressionLevel: 9 })
    .toFile(new URL(`${name}.png`, directory).pathname);
}
const metadata = {
  sourceFile,
  sourceSha256,
  mapVersion: MAPS.sun.version,
  width: info.width,
  height: info.height,
  atlasWidth: result.atlasWidth,
  atlasHeight: result.atlasHeight,
  tiles: result.tiles,
  components: result.components,
  ...STENCIL,
  atlasFile: `${key}/atlas.png`,
  pagesFile: `${key}/pages.png`,
};
await writeFile(
  new URL("../src/features/sun/lib/graphics/spot-stencil.generated.json", import.meta.url),
  `${JSON.stringify(metadata, null, 2)}\n`,
);
console.log(
  `${result.components} spot/pore components; ${result.tiles} source tiles → ${result.atlasWidth} × ${result.atlasHeight} atlas`,
);
console.log(
  `\nUpload the new folder (scripts/README.md):\naws s3 cp cdn${key}/ s3://horizon-cdn${key}/ ` +
    `--recursive --content-type image/png --cache-control "public, max-age=31536000, immutable" ` +
    `--profile horizon-cdn`,
);
