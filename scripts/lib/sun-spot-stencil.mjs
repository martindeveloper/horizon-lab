/** Offline appearance masks for the HMI mosaic; these are not measured heights or fields. */
export const STENCIL = {
  tile: 64,
  gutter: 2,
  penumbraThreshold: 0.88,
  seedThreshold: 0.8,
  umbraThreshold: 0.45,
  penumbraRange: 8,
  umbraRange: 32,
};

/** Hysteresis excludes quiet-Sun texture without filling light bridges or joining groups.
 * Longitude wraps; latitude does not. Even a small resolved pore can seed a component. */
export function spotComponents(intensity, width, height, settings = STENCIL) {
  const mask = new Uint8Array(intensity.length);
  const visited = new Uint8Array(intensity.length);
  const queue = new Int32Array(intensity.length);
  let count = 0;
  for (let i = 0; i < intensity.length; i++) {
    if (visited[i] || intensity[i] >= settings.penumbraThreshold) continue;
    let head = 0;
    let tail = 1;
    let seed = false;
    queue[0] = i;
    visited[i] = 1;
    while (head < tail) {
      const p = queue[head++];
      seed ||= intensity[p] < settings.seedThreshold;
      const x = p % width;
      for (const n of [
        p + (x === 0 ? width - 1 : -1),
        p + (x === width - 1 ? 1 - width : 1),
        p - width,
        p + width,
      ]) {
        if (
          n >= 0 &&
          n < intensity.length &&
          !visited[n] &&
          intensity[n] < settings.penumbraThreshold
        ) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
    }
    if (!seed || tail < 3) continue;
    count++;
    for (let j = 0; j < tail; j++) mask[queue[j]] = 1;
  }
  return { mask, count };
}

/** Squared Euclidean distance transform: lower envelope of 1D parabolas, in each axis. */
function edt(grid, width, height) {
  const size = Math.max(width, height);
  const f = new Float64Array(size);
  const v = new Int32Array(size);
  const z = new Float64Array(size + 1);
  function line(start, stride, length) {
    for (let q = 0; q < length; q++) f[q] = grid[start + q * stride];
    let k = 0;
    v[0] = 0;
    z[0] = -Infinity;
    z[1] = Infinity;
    for (let q = 1; q < length; q++) {
      let s;
      do {
        const r = v[k];
        s = (f[q] - f[r] + q * q - r * r) / (2 * (q - r));
        if (s > z[k]) break;
        k--;
      } while (k >= 0);
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < length; q++) {
      while (z[k + 1] < q) k++;
      const d = q - v[k];
      grid[start + q * stride] = d * d + f[v[k]];
    }
  }
  for (let x = 0; x < width; x++) line(x, width, height);
  for (let y = 0; y < height; y++) line(y * width, 1, width);
}

/** Signed distance (negative inside), with fractional boundary seeds from the intensity
 * gradient. Bilinear sampling then retains subpixel contours instead of magnifying a bitmap. */
export function contourDistance(intensity, width, height, threshold) {
  const outer = new Float64Array(intensity.length);
  const inner = new Float64Array(intensity.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const dx =
        (intensity[y * width + Math.min(x + 1, width - 1)] -
          intensity[y * width + Math.max(x - 1, 0)]) *
        0.5;
      const dy =
        (intensity[Math.min(y + 1, height - 1) * width + x] -
          intensity[Math.max(y - 1, 0) * width + x]) *
        0.5;
      const d = (intensity[i] - threshold) / Math.max(Math.hypot(dx, dy), 1e-6);
      // Only boundary pixels seed fractional distances. Interior pixels use the EDT.
      outer[i] = d <= 0 ? 0 : d < 1 ? d * d : 1e12;
      inner[i] = d >= 0 ? 0 : d > -1 ? d * d : 1e12;
    }
  }
  edt(outer, width, height);
  edt(inner, width, height);
  return Float32Array.from(outer, (d, i) => Math.sqrt(d) - Math.sqrt(inner[i]));
}

export const encodeDistance = (distance, range) =>
  Math.round(255 * Math.max(0, Math.min(1, 0.5 + distance / (2 * range))));

/** Sparse virtual texture: full source resolution at a fraction of a second globe texture's
 * GPU cost. Each occupied tile has neighbouring source pixels in its gutter for filtering.
 * R: original linear continuum; G/B: penumbral/umbral distance. The page table is byte data. */
export function buildSpotAtlas(intensity, width, height, quietIntensity, settings = STENCIL) {
  const { tile, gutter, penumbraRange, umbraRange } = settings;
  if (width % tile || height % tile) throw new Error("Stencil dimensions must divide into tiles");
  const columns = width / tile;
  const rows = height / tile;
  const { mask, count } = spotComponents(intensity, width, height, settings);
  const active = new Uint8Array(columns * rows);
  const wrap = (x) => ((x % width) + width) % width;
  const sample = (x, y) => Math.max(0, Math.min(height - 1, y)) * width + wrap(x);
  const margin = penumbraRange + gutter + 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      for (const dy of [-margin, 0, margin]) {
        for (const dx of [-margin, 0, margin]) {
          const ty = Math.floor(Math.max(0, Math.min(height - 1, y + dy)) / tile);
          active[ty * columns + Math.floor(wrap(x + dx) / tile)] = 1;
        }
      }
    }
  }
  const tiles = active.reduce((sum, value) => sum + value, 0);
  const atlasColumns = Math.max(1, Math.ceil(Math.sqrt(tiles)));
  const atlasRows = Math.max(1, Math.ceil(tiles / atlasColumns));
  if (atlasColumns > 255 || atlasRows > 255) throw new Error("Stencil page table overflow");
  const stride = tile + 2 * gutter;
  const atlasWidth = atlasColumns * stride;
  const atlasHeight = atlasRows * stride;
  const atlas = Buffer.alloc(atlasWidth * atlasHeight * 3);
  const pages = Buffer.alloc(columns * rows * 3);
  // The halo is wider than either distance range, so clamped distances do not depend on tiles.
  const halo = Math.ceil(Math.max(penumbraRange, umbraRange)) + 3;
  const workWidth = stride + 2 * halo;
  let next = 0;
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < columns; tx++) {
      if (!active[ty * columns + tx]) continue;
      const ax = next % atlasColumns;
      const ay = Math.floor(next / atlasColumns);
      next++;
      pages[(ty * columns + tx) * 3] = ax + 1;
      pages[(ty * columns + tx) * 3 + 1] = ay + 1;
      const work = new Float32Array(workWidth * workWidth);
      for (let y = 0; y < workWidth; y++) {
        for (let x = 0; x < workWidth; x++) {
          const i = sample(tx * tile + x - gutter - halo, ty * tile + y - gutter - halo);
          // Rejected quiet texture cannot produce an isolated synthetic pore.
          work[y * workWidth + x] = mask[i]
            ? intensity[i]
            : Math.max(intensity[i], settings.penumbraThreshold + 1e-3);
        }
      }
      const penumbra = contourDistance(work, workWidth, workWidth, settings.penumbraThreshold);
      const umbra = contourDistance(work, workWidth, workWidth, settings.umbraThreshold);
      for (let y = 0; y < stride; y++) {
        for (let x = 0; x < stride; x++) {
          const i = sample(tx * tile + x - gutter, ty * tile + y - gutter);
          const w = (y + halo) * workWidth + x + halo;
          const out = ((ay * stride + y) * atlasWidth + ax * stride + x) * 3;
          atlas[out] = Math.round(255 * Math.max(0, Math.min(1, intensity[i] * quietIntensity)));
          atlas[out + 1] = encodeDistance(penumbra[w], penumbraRange);
          atlas[out + 2] = encodeDistance(umbra[w], umbraRange);
        }
      }
    }
  }
  return { atlas, pages, atlasWidth, atlasHeight, columns, rows, tiles, components: count };
}
