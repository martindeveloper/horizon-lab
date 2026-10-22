/**
 * Numerical CMB resampling. Only the pinned HEALPix NESTED and zero-origin ICRS
 * CAR schemas are supported; reject other WCS rather than guessing coordinates.
 * HEALPix reference: https://healpix.sourceforge.io/html/csub_ang2pix_nest.htm
 * Galactic→ICRS rotation: Astropy's Galactic→FK5(J2000)→ICRS transform,
 * https://github.com/astropy/astropy/tree/main/astropy/coordinates/builtin_frames
 * (galactic_transforms.py and icrs_fk5_transforms.py). This includes the ICRS
 * frame bias; it is not the rounded FK5/J2000 pole used for illustrative labels.
 */
import assert from "node:assert/strict";
import { openSync, closeSync } from "node:fs";
import { join } from "node:path";

import { fitsColumns, readExactly, readFitsFileHeader } from "./fits.mjs";
import { roundEven } from "./scientific-data.mjs";

const RAD = Math.PI / 180;
export const SCALE = 0.1;
export const OFFSET = 32768;
const ICRS = [
  [-0.054875657712591654, 0.49410943719272676, -0.8676661375596576],
  [-0.8734370519556157, -0.4448297212232952, -0.19807633727300059],
  [-0.48383507361671546, 0.7469821839866674, 0.4559838136873016],
];

export function galacticToIcrs(l, b) {
  const cb = Math.cos(b * RAD);
  const v = [cb * Math.cos(l * RAD), cb * Math.sin(l * RAD), Math.sin(b * RAD)];
  const [x, y, z] = ICRS.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
  return [Math.atan2(y, x) / RAD, Math.atan2(z, Math.hypot(x, y)) / RAD];
}

function spreadBits(n) {
  n = (n | (n << 8)) & 0x00ff00ff;
  n = (n | (n << 4)) & 0x0f0f0f0f;
  n = (n | (n << 2)) & 0x33333333;
  return (n | (n << 1)) & 0x55555555;
}

/** Longitude/latitude in degrees to a NESTED index. NSIDE must be a power of 2 ≤ 8192. */
export function healpixNested(l, b, nside = 512) {
  assert(Number.isInteger(nside) && nside > 0 && nside <= 8192 && (nside & (nside - 1)) === 0);
  assert(Number.isFinite(l) && Number.isFinite(b) && Math.abs(b) <= 90);
  // Adapted from Astrometry.net's xyztohp, also used by astropy-healpix.
  // BSD-3-Clause notice: ../licenses/astrometry-net-LICENSE.txt.
  // Keep its pixel-edge ownership, including exact equatorial corners.
  const z = Math.sin(b * RAD),
    cosine = Math.cos(b * RAD);
  let longitude = Math.atan2(cosine * Math.sin(l * RAD), cosine * Math.cos(l * RAD));
  if (longitude < 0) longitude += 2 * Math.PI;
  const halfPi = Math.PI / 2,
    within = longitude % halfPi;
  const quadrant = Math.round((longitude - within) / halfPi) % 4;
  let face, x, y;
  if (Math.abs(z) >= 2 / 3) {
    const radius = (cosine / Math.sqrt(1 + Math.abs(z))) * Math.sqrt(3);
    const a = radius * Math.abs((nside * (2 * within - Math.PI)) / Math.PI);
    const c = (radius * nside * 2 * within) / Math.PI;
    face = quadrant + (z >= 0 ? 0 : 8);
    x = z >= 0 ? nside - a : c;
    y = z >= 0 ? nside - c : a;
  } else {
    const vertical = (z + 2 / 3) / (4 / 3),
      horizontal = within / halfPi;
    x = (vertical + horizontal) * nside;
    y = (vertical - horizontal + 1) * nside;
    const right = x >= nside,
      upper = y >= nside;
    face = right
      ? upper
        ? quadrant
        : ((quadrant + 1) % 4) + 4
      : upper
        ? quadrant + 4
        : quadrant + 8;
    if (right) x -= nside;
    if (upper) y -= nside;
  }
  const ix = Math.max(0, Math.min(nside - 1, Math.floor(x)));
  const iy = Math.max(0, Math.min(nside - 1, Math.floor(y)));
  return face * nside * nside + spreadBits(ix) + 2 * spreadBits(iy);
}

export function planckSampler(path) {
  const fd = openSync(path, "r");
  try {
    const primary = readFitsFileHeader(fd);
    assert.equal(primary.header.NAXIS, 0);
    const { header: h, offset } = readFitsFileHeader(fd, primary.offset);
    assert.equal(h.ORDERING, "NESTED");
    assert.equal(h.COORDSYS, "GALACTIC");
    assert.equal(h.NSIDE, 2048);
    assert.equal(h.NAXIS2, 12 * h.NSIDE ** 2);
    const columns = fitsColumns(h);
    for (const key of ["I_STOKES", "TMASK", "TMASKINP"]) {
      assert.equal(columns[key]?.kind, "E");
      assert.equal(columns[key]?.count, 1);
    }
    assert.equal(columns.I_STOKES.unit, "K_CMB");
    const count = h.NAXIS2 / 16;
    const mean = new Float32Array(count),
      good = new Uint8Array(count);
    const parentsPerChunk = 16384;
    const buffer = Buffer.alloc(parentsPerChunk * 16 * h.NAXIS1);
    // NESTED children occupy 16 contiguous rows. Do not use I_STOKES_INP.
    for (let first = 0; first < count; first += parentsPerChunk) {
      const parents = Math.min(parentsPerChunk, count - first);
      readExactly(fd, buffer, offset + first * 16 * h.NAXIS1, parents * 16 * h.NAXIS1);
      for (let p = 0; p < parents; p++) {
        let total = 0,
          valid = true;
        for (let child = 0; child < 16; child++) {
          const at = (p * 16 + child) * h.NAXIS1;
          const t = buffer.readFloatBE(at + columns.I_STOKES.offset);
          valid &&=
            Number.isFinite(t) &&
            t > -1e20 &&
            buffer.readFloatBE(at + columns.TMASK.offset) === 1 &&
            buffer.readFloatBE(at + columns.TMASKINP.offset) === 1;
          total += t;
        }
        good[first + p] = Number(valid);
        mean[first + p] = valid ? (total / 16) * 1e6 : 0;
      }
    }
    return (l, b) => {
      const pixel = healpixNested(l, b);
      return [mean[pixel], good[pixel]];
    };
  } finally {
    closeSync(fd);
  }
}

export function validateActHeaders(h, footprint, inpaint) {
  for (const header of [h, footprint, inpaint]) {
    assert.equal(header.NAXIS, 2);
    assert.equal(header.NAXIS1, 43200);
    assert.equal(header.NAXIS2, 10320);
    assert.equal(header.CTYPE1, "RA---CAR");
    assert.equal(header.CTYPE2, "DEC--CAR");
    assert.equal(header.RADESYS, "ICRS");
    assert.equal(header.CUNIT1, "deg");
    assert.equal(header.CUNIT2, "deg");
    assert.equal(header.CRVAL1, 0);
    assert.equal(header.CRVAL2, 0);
    assert.equal(header.LONPOLE, 0);
    assert.equal(header.LATPOLE, 90);
    assert.equal(header.BSCALE ?? 1, 1);
    for (const key of Object.keys(header))
      assert(!/^(PC|CD)\d+_\d+$/.test(key), "Rotated CAR WCS unsupported");
  }
  assert.equal(h.BITPIX, -32);
  assert.equal(footprint.BITPIX, -32);
  assert.equal(h.BZERO ?? 0, 0);
  assert.equal(footprint.BZERO ?? 0, 0);
  assert.equal(h.BUNIT, "uK");
  assert.equal(h.CRPIX1, 21601);
  assert.equal(h.CRPIX2, 7560.5);
  assert(Math.abs(h.CDELT1 + 1 / 120) < 1e-15 && Math.abs(h.CDELT2 - 1 / 120) < 1e-15);
  for (const mask of [footprint, inpaint]) {
    for (const key of ["CRPIX1", "CDELT1", "CDELT2", "CRVAL1", "CRVAL2"])
      assert.equal(mask[key], h[key]);
    assert.equal(mask.CRPIX2 - h.CRPIX2, 0.5);
  }
  assert.equal(inpaint.BITPIX, 8);
  assert.equal(inpaint.BZERO, -128);
}

/** Six signal rows and seven mask rows. Both adjacent masks must pass the half-row WCS offset. */
export function binActRows(signal, footprint, inpaint, h, y, factor = 6) {
  const width = h.NAXIS1,
    height = h.NAXIS2,
    bins = width / factor;
  assert(Number.isInteger(bins));
  for (const flag of inpaint) assert(flag === 128 || flag === 129, "Unexpected ACT inpaint flag");
  const weight = Array.from({ length: factor }, (_, row) =>
    Math.cos((y + row + 1 - h.CRPIX2) * h.CDELT2 * RAD),
  );
  const divisor = weight.reduce((a, b) => a + b, 0) * factor;
  const mean = new Float32Array(bins),
    good = new Uint8Array(bins);
  for (let x = 0; x < bins; x++) {
    let total = 0,
      valid = true;
    for (let row = 0; row < factor; row++) {
      // Sum within each row before summing rows, as in the former NumPy export.
      let rowTotal = 0;
      for (let col = 0; col < factor; col++) {
        const at = row * width + x * factor + col;
        const next = Math.min(row + 1, height - y - 1) * width + x * factor + col;
        const t = signal.readFloatBE(at * 4);
        valid &&=
          y + row + 1 < height &&
          Number.isFinite(t) &&
          footprint.readFloatBE(at * 4) >= Math.fround(0.99) &&
          footprint.readFloatBE(next * 4) >= Math.fround(0.99) &&
          inpaint[at] === 128 &&
          inpaint[next] === 128;
        rowTotal += t * weight[row];
      }
      total += rowTotal;
    }
    good[x] = Number(valid);
    mean[x] = valid ? total / divisor : 0;
  }
  return { mean, good };
}

export function actPixel(l, b, h, factor = 6) {
  const [ra, dec] = galacticToIcrs(l, b);
  const x = ra / h.CDELT1 + h.CRPIX1 - 1;
  const y = dec / h.CDELT2 + h.CRPIX2 - 1;
  return [
    Math.floor(((((x + 0.5) % h.NAXIS1) + h.NAXIS1) % h.NAXIS1) / factor),
    Math.floor((y + 0.5) / factor),
  ];
}

export function actSampler(cache) {
  const fds = [];
  try {
    for (const name of ["act", "act-footprint", "act-inpaint"])
      fds.push(openSync(join(cache, `${name}.fits`), "r"));
    const inputs = fds.map((fd) => readFitsFileHeader(fd));
    const h = inputs[0].header;
    validateActHeaders(h, inputs[1].header, inputs[2].header);
    const width = h.NAXIS1,
      height = h.NAXIS2,
      factor = 6;
    const mean = new Float32Array((width * height) / factor ** 2),
      good = new Uint8Array(mean.length);
    const buffers = [
      Buffer.alloc(width * factor * 4),
      Buffer.alloc(width * (factor + 1) * 4),
      Buffer.alloc(width * (factor + 1)),
    ];
    for (let y = 0; y < height; y += factor) {
      const masks = Math.min(factor + 1, height - y);
      for (let i = 0; i < fds.length; i++) {
        const bytes = i === 2 ? 1 : 4;
        readExactly(
          fds[i],
          buffers[i],
          inputs[i].offset + y * width * bytes,
          width * (i === 0 ? factor : masks) * bytes,
        );
      }
      const row = binActRows(buffers[0], buffers[1], buffers[2].subarray(0, width * masks), h, y);
      const offset = (y / factor) * (width / factor);
      mean.set(row.mean, offset);
      good.set(row.good, offset);
    }
    return (l, b) => {
      const [ix, iy] = actPixel(l, b, h);
      if (iy < 0 || iy >= height / factor) return [0, 0];
      const pixel = iy * (width / factor) + ix;
      return [mean[pixel], good[pixel]];
    };
  } finally {
    for (const fd of fds) closeSync(fd);
  }
}

export function projectCmb(sample, width) {
  assert(Number.isInteger(width) && width > 0 && width % 2 === 0);
  const height = width / 2;
  const temperature = new Float32Array(width * height),
    valid = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let total = 0,
        weights = 0,
        good = true;
      for (const dy of [0.25, 0.75]) {
        const b = 90 - ((y + dy) * 180) / height,
          weight = Math.cos(b * RAD);
        for (const dx of [0.25, 0.75]) {
          const [value, trusted] = sample(((x + dx) * 360) / width, b);
          total += value * weight;
          weights += weight;
          good &&= Boolean(trusted);
        }
      }
      const at = y * width + x;
      temperature[at] = total / weights;
      valid[at] = Number(good);
    }
  }
  return { temperature, valid };
}

export function encodeCmb(temperature, valid) {
  assert.equal(temperature.length, valid.length);
  const rgba = Buffer.alloc(temperature.length * 4);
  for (let i = 0; i < temperature.length; i++) {
    // NumPy's former float32 / scalar operation rounds before rint. Preserve
    // that precision (including half ties), not JS's double-precision division.
    const code = valid[i]
      ? roundEven(Math.fround(temperature[i] / Math.fround(SCALE))) + OFFSET
      : OFFSET;
    assert(Number.isFinite(code) && code > 0 && code < 65536, "Do not silently clip CMB data");
    rgba[i * 4] = code >> 8;
    rgba[i * 4 + 1] = code & 255;
    rgba[i * 4 + 2] = valid[i] ? 255 : 0;
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}
