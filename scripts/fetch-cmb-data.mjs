/**
 * Rebuild pinned numerical CMB textures using Node and the installed sharp.
 * node scripts/fetch-cmb-data.mjs [--cache /tmp/horizon-cmb-data] [--output /tmp/review]
 * Raw FITS (~6 GB) stay outside the repository. Bounded row reads avoid loading
 * whole files into memory. See docs/deep-field-cmb.md before changing a release.
 * Writes cdn/textures/cmb/v<VERSION>/. Bump VERSION for changed maps; never
 * overwrite a published key. Upload the printed folder (scripts/README.md).
 * Never use inpainted pixels or substitute frequency maps for CMB components.
 */
import assert from "node:assert/strict";
import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { parseArgs } from "node:util";

import sharp from "sharp";

import {
  planckSampler,
  actSampler,
  projectCmb,
  encodeCmb,
  SCALE,
  OFFSET,
} from "./lib/cmb-data.mjs";
import { root, fileSha256, writeJson } from "./lib/scientific-data.mjs";

const VERSION = 1;
const KEY = `/textures/cmb/v${VERSION}`;

// Update URLs, expected byte counts/hashes and this scientific recipe together.
// Pin raw bytes as well as release names; a changed archive must be reviewed.
const PINNED = {
  reviewed: "2026-10-23",
  planckRelease: "Planck 2018 PR3 · SMICA R3.00",
  actRelease: "ACT DR6.02 + Planck · NILC · tSZ deprojected",
  planckPage: "https://irsa.ipac.caltech.edu/data/Planck/release_3/all-sky-maps/matrix_cmb.html",
  actPage: "https://lambda.gsfc.nasa.gov/product/act/act_dr6.02/act_dr6.02_nilc_info.html",
  encoding: {
    unit: "microkelvin",
    scale: SCALE,
    offset: OFFSET,
    channels: "R*256+G; B=255 valid, B=0 masked; A=255; no colour space conversion",
  },
  projection:
    "Galactic equirectangular: l=(x+0.5)*360/width; b=90-(y+0.5)*180/height; north in first row",
  resampling:
    "Planck: equal-area NESTED average NSIDE 2048 to 512. ACT: area-weighted 6x6 CAR bins. Both: four area-weighted subpixel samples per output cell; all contributing masks must pass. Display resolution is below native survey resolution.",
  planckMask:
    "I_STOKES (K_CMB converted to microkelvin); require TMASK=1 AND TMASKINP=1. Never use I_STOKES_INP.",
  actMask:
    "blackbody_T_deproj_SZ (microkelvin); footprint>=0.99 and physical ilc_inpaint_mask=0 (stored byte 128). Inpaint flag=1 is excluded. Masks have a +0.5 native-row WCS offset relative to the signal; both neighbouring mask rows must pass. Source subtraction and residual foregrounds/noise remain part of the released reconstruction.",
  inputs: {
    planck: {
      url: "https://irsa.ipac.caltech.edu/data/Planck/release_3/all-sky-maps/maps/component-maps/cmb/COM_CMB_IQU-smica_2048_R3.00_full.fits",
      bytes: 2013312960,
      sha256: "60952c645eb33d151905ddf5837477e15ca02a3261feca4ceca3c3feece4f9ac",
    },
    act: {
      url: "https://lambda.gsfc.nasa.gov/data/act/nilc/published/act-planck_dr6.02_nilc_blackbody_T_deproj_SZ.fits",
      bytes: 1783298880,
      sha256: "ee0b2cb0235777824c7b88cc9ad6aa78ab109ef69076c2f891a6f1baa85f9699",
    },
    "act-footprint": {
      url: "https://lambda.gsfc.nasa.gov/data/act/nilc/published/ilc_footprint_mask.fits",
      bytes: 1783298880,
      sha256: "4045a7fc91c2bc7f83a808aad0ec770f79318b78f60be181e65b5eee30ff38ae",
    },
    "act-inpaint": {
      url: "https://lambda.gsfc.nasa.gov/data/act/nilc/published/ilc_inpaint_mask.fits",
      bytes: 445826880,
      sha256: "ed7395cba5a536693258292b62f9378d567f71e18cb8d4d4485e49799c357e10",
    },
  },
};

async function ensureInput(name, input, cache) {
  const path = join(cache, `${name}.fits`);
  if (!existsSync(path)) {
    console.log(`Downloading ${name}`);
    const response = await fetch(input.url);
    assert(response.ok && response.body, `${name}: HTTP ${response.status}`);
    const part = `${path}.part`;
    try {
      await pipeline(Readable.fromWeb(response.body), createWriteStream(part));
      assert.equal(statSync(part).size, input.bytes, `${name}: incomplete download`);
      assert.equal(
        await fileSha256(part),
        input.sha256,
        `${name}: source bytes changed; review release`,
      );
      await rename(part, path);
    } catch (error) {
      await rm(part, { force: true });
      throw error;
    }
  }
  assert.equal(
    statSync(path).size,
    input.bytes,
    `${name}: incomplete cached download; remove/re-download`,
  );
  assert.equal(
    await fileSha256(path),
    input.sha256,
    `${name}: cached source hash differs; review release`,
  );
}

async function exportMap(name, sample, width, output) {
  const height = width / 2;
  const { temperature, valid } = projectCmb(sample, width);
  const rgba = encodeCmb(temperature, valid);
  const path = join(output, `cmb-${name}.png`);
  // Keep existing PNG bytes/hashes if all numerical channels are unchanged.
  // Compression-library changes must not churn a scientifically identical asset.
  let unchanged = false;
  if (existsSync(path)) {
    const previous = await sharp(path).raw().toBuffer({ resolveWithObject: true });
    unchanged =
      previous.info.width === width &&
      previous.info.height === height &&
      previous.info.channels === 4 &&
      previous.data.equals(rgba);
  }
  if (!unchanged)
    await sharp(rgba, { raw: { width, height, channels: 4 } })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(path);
  let validPixels = 0,
    weightedValid = 0,
    totalWeight = 0,
    min = Infinity,
    max = -Infinity;
  for (let y = 0; y < height; y++) {
    const weight = Math.cos(((90 - ((y + 0.5) * 180) / height) * Math.PI) / 180);
    let rowCount = 0;
    for (let x = 0; x < width; x++) {
      const at = y * width + x;
      if (!valid[at]) continue;
      rowCount++;
      min = Math.min(min, temperature[at]);
      max = Math.max(max, temperature[at]);
    }
    validPixels += rowCount;
    weightedValid += rowCount * weight;
    totalWeight += width * weight;
  }
  assert(validPixels > 0, "Empty CMB coverage");
  const locations = [
    [Math.floor(height / 4), Math.floor(width / 8)],
    [Math.floor(height / 3), Math.floor(width / 3)],
    [Math.floor(height / 2), Math.floor(width / 2)],
    [Math.floor((3 * height) / 4), Math.floor((7 * width) / 8)],
  ];
  const targets = [0.2, 0.5, 0.8].map((fraction) => Math.floor(validPixels * fraction));
  let seen = 0,
    target = 0;
  for (let i = 0; i < valid.length && target < targets.length; i++) {
    if (!valid[i]) continue;
    if (seen === targets[target]) {
      locations.push([Math.floor(i / width), i % width]);
      target++;
    }
    seen++;
  }
  const referencePixels = locations.map(([y, x]) => {
    const at = y * width + x;
    return {
      x,
      y,
      valid: Boolean(valid[at]),
      microkelvin: Number(((rgba[at * 4] * 256 + rgba[at * 4 + 1] - OFFSET) * SCALE).toFixed(6)),
    };
  });
  return {
    path: `${KEY}/cmb-${name}.png`,
    width,
    height,
    sha256: await fileSha256(path),
    bytes: statSync(path).size,
    validPixels,
    validSkyFraction: weightedValid / totalWeight,
    minMicrokelvin: min,
    maxMicrokelvin: max,
    referencePixels,
  };
}

const { values: args } = parseArgs({
  options: {
    cache: { type: "string", default: "/tmp/horizon-cmb-data" },
    output: { type: "string", default: root },
  },
});
mkdirSync(args.cache, { recursive: true });
for (const [name, input] of Object.entries(PINNED.inputs))
  await ensureInput(name, input, args.cache);
const output = join(args.output, `cdn${KEY}`);
mkdirSync(output, { recursive: true });
const products = {};
products.planck = await exportMap(
  "planck",
  planckSampler(join(args.cache, "planck.fits")),
  2048,
  output,
);
console.log("Planck exported");
products.act = await exportMap("act", actSampler(args.cache), 4096, output);
console.log("ACT exported");
writeJson(join(args.output, "src/space/cosmos/model/data/cmb-source.json"), {
  ...PINNED,
  products,
});
console.log(
  `\nUpload the new folder (scripts/README.md):\naws s3 cp cdn${KEY}/ s3://horizon-cdn${KEY}/ --recursive --content-type image/png --cache-control "public, max-age=31536000, immutable" --profile horizon-cdn`,
);
