import { ATOMIC_MASS_KG, dopplerFactor, planckRadiance } from "@horizon/toolkit/science";

import { layerAt, type Photosphere } from "./atmospheres";
import { ELEMENTS, LINES, type ElementId, type Line } from "./atoms";
import {
  lineCrossSection,
  lineProfile,
  lineShape,
  reach,
  shapeAt,
  type Conditions,
  type Gas,
  type Profile,
  type Shape,
} from "./profile";
import { TELLURIC } from "./telluric";
import { voigt } from "./voigt";

/**
 * What the spectrograph records, two ways.
 *
 * A slab of gas in the lab (`slab`), uniform and in equilibrium, in front of a black body or of
 * nothing: I(λ) = I₀(λ) e^(−τ) + B_λ(T) (1 − e^(−τ)). A hotter source behind gives dark lines,
 * nothing behind gives bright ones, a cooler source bright lines on a faint continuum:
 * Kirchhoff's three laws from one equation.
 *
 * A star (`star`): light integrated up through the layers of a model photosphere, each in
 * local thermodynamic equilibrium at its own temperature and pressure, with the continuum's
 * opacity the model's Rosseland mean. The emergent flux is taken in the Eddington–Barbier
 * approximation, F ≈ π I(μ = 2/3).
 *
 * Both then cross Earth's air (`airmass`) and the spectrograph (`resolution`).
 */
type Instrument = {
  /** Line-of-sight speed of the source, km/s, positive when receding. */
  velocity: number;
  /** Air masses of Earth's atmosphere in the beam: 0 in space or the lab. */
  airmass: number;
  /** Resolving power λ / Δλ of the spectrograph. */
  resolution: number;
};

export type SlabObservation = Instrument & {
  kind: "slab";
  gas: Gas;
  /** Temperature of the black body behind the gas, K; null when only the gas shines. */
  background: number | null;
};

export type StarObservation = Instrument & {
  kind: "star";
  photosphere: Photosphere;
  /** km/s. */
  microturbulence: number;
  /** Changes to the Sun's abundances, dex, by element. */
  abundances?: Partial<Record<ElementId, number>>;
};

export type Observation = SlabObservation | StarObservation;

export type Spectrum = {
  /** Pixel centres, nm, evenly spaced. */
  wavelengths: Float64Array;
  /** What reaches the detector, W m⁻² sr⁻¹ m⁻¹ (stars: π I(2/3) per steradian). */
  flux: Float64Array;
  /** The source's continuum without lines; zeros when nothing shines behind the gas. */
  continuum: Float64Array;
  /** The largest flux or continuum in view, for scaling plots. */
  peak: number;
};

/** Below this, a line's optical depth is ignored. */
const TAU_FLOOR = 1e-4;
/** The finest step in ln λ (0.45 km/s), and the most samples a window may take. */
const FINE_STEP = 1.5e-6;
const MAX_FINE = { slab: 160_000, star: 60_000 };
const FWHM_PER_SIGMA = 2 * Math.sqrt(2 * Math.LN2);
/** The Eddington–Barbier direction: F = π I(μ = 2/3), exact for a source function linear in τ. */
const MU = 2 / 3;
/** The Sun's hydrogen mass fraction (Asplund et al. 2009). */
const HYDROGEN_MASS_FRACTION = 0.7381;
/** Where a metal line's shape is taken, and hydrogen's (whose wings form deep). */
const SHAPE_DEPTH = { metal: -1, hydrogen: -0.5 };

type Grid = { lnStart: number; step: number; count: number };

function gridFor(from: number, to: number, resolution: number, max: number): Grid {
  const sigma = 1 / (resolution * FWHM_PER_SIGMA);
  const lnStart = Math.log(from) - 5 * sigma;
  const lnEnd = Math.log(to) + 5 * sigma;
  const count = Math.min(max, Math.ceil((lnEnd - lnStart) / FINE_STEP));
  return { lnStart, step: (lnEnd - lnStart) / count, count };
}

/** Calls `visit(i, h)` with H(a, v) at every grid sample the profile reaches. */
function sweep(p: Profile, grid: Grid, visit: (i: number, h: number) => void, cap = 40) {
  const width = reach(p, TAU_FLOOR, cap);
  const first = Math.max(0, Math.ceil((Math.log(p.centre - width) - grid.lnStart) / grid.step));
  const last = Math.min(
    grid.count - 1,
    Math.floor((Math.log(p.centre + width) - grid.lnStart) / grid.step),
  );
  const ratio = Math.exp(grid.step);
  let nm = Math.exp(grid.lnStart + first * grid.step);
  for (let i = first; i <= last; i++) {
    visit(i, shapeAt(p, (nm - p.centre) / p.doppler));
    nm *= ratio;
  }
}

function airTransmission(grid: Grid, airmass: number) {
  const tau = new Float64Array(grid.count);
  if (airmass > 0)
    for (const p of TELLURIC)
      sweep({ ...p, peak: p.peak * airmass }, grid, (i, h) => {
        tau[i]! += p.peak * airmass * h;
      });
  return tau.map((t) => Math.exp(-t));
}

/** Box-averages `values` in groups of `k`, then convolves with a Gaussian of σ samples. */
function smooth(values: Float64Array, k: number, sigma: number) {
  const n = Math.floor(values.length / k);
  const binned = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < k; j++) sum += values[i * k + j]!;
    binned[i] = sum / k;
  }
  if (sigma < 0.3) return binned;
  const half = Math.ceil(4 * sigma);
  const kernel = new Float64Array(2 * half + 1);
  for (let j = -half; j <= half; j++) kernel[j + half] = Math.exp(-0.5 * (j / sigma) ** 2);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let weight = 0;
    for (let j = Math.max(-half, -i); j <= Math.min(half, n - 1 - i); j++) {
      sum += binned[i + j]! * kernel[j + half]!;
      weight += kernel[j + half]!;
    }
    out[i] = sum / weight;
  }
  return out;
}

/** The instrument's blur, then the fine grid resampled to `samples` evenly spaced pixels. */
function observe(
  fine: Float64Array,
  grid: Grid,
  resolution: number,
  from: number,
  to: number,
  samples: number,
  continuumAt: (nm: number) => number,
): Spectrum {
  const sigma = 1 / (resolution * FWHM_PER_SIGMA);
  const k = Math.max(1, Math.floor(sigma / (3 * grid.step)));
  const blurred = smooth(fine, k, sigma / (k * grid.step));
  const coarseStep = k * grid.step;
  const coarseStart = grid.lnStart + ((k - 1) / 2) * grid.step;
  /* Running sums, so each pixel can average the light across its own width, as a detector does. */
  const sums = new Float64Array(blurred.length + 1);
  for (let i = 0; i < blurred.length; i++) sums[i + 1] = sums[i]! + blurred[i]!;
  const indexOf = (nm: number) =>
    Math.min(blurred.length - 1, Math.max(0, (Math.log(nm) - coarseStart) / coarseStep));
  const sumTo = (x: number) => {
    const i = Math.floor(x + 0.5);
    return sums[i]! + (x + 0.5 - i) * (blurred[Math.min(i, blurred.length - 1)] ?? 0);
  };
  const pixel = samples > 1 ? (to - from) / (samples - 1) : 0;
  const wavelengths = new Float64Array(samples);
  const flux = new Float64Array(samples);
  const continuum = new Float64Array(samples);
  let peak = 0;
  for (let s = 0; s < samples; s++) {
    const nm = samples === 1 ? from : from + pixel * s;
    wavelengths[s] = nm;
    const a = indexOf(nm - pixel / 2);
    const b = indexOf(nm + pixel / 2);
    if (b - a >= 1) flux[s] = (sumTo(b) - sumTo(a)) / (b - a);
    else {
      const x = indexOf(nm);
      const i = Math.min(blurred.length - 2, Math.floor(x));
      const t = x - i;
      flux[s] = blurred[i]! * (1 - t) + blurred[i + 1]! * t;
    }
    continuum[s] = continuumAt(nm);
    peak = Math.max(peak, flux[s]!, continuum[s]!);
  }
  return { wavelengths, flux, continuum, peak };
}

/* ─── The lab: a uniform slab ─── */

/** Every line the slab's gas absorbs, with its profile at the source's velocity. */
export function slabProfiles(obs: SlabObservation) {
  const shift = dopplerFactor(obs.velocity);
  const out: { line: Line; profile: Profile }[] = [];
  for (const line of LINES) {
    const profile = lineProfile(line, obs.gas, shift);
    if (profile && profile.peak * voigt(profile.damping, 0) > TAU_FLOOR)
      out.push({ line, profile });
  }
  return out;
}

function synthesizeSlab(obs: SlabObservation, from: number, to: number, samples: number) {
  const grid = gridFor(from, to, obs.resolution, MAX_FINE.slab);
  const tau = new Float64Array(grid.count);
  for (const { profile } of slabProfiles(obs))
    /* A dense bench gas can keep its wings dark across the whole window: no cut-off. */
    sweep(
      profile,
      grid,
      (i, h) => {
        tau[i]! += profile.peak * h;
      },
      Infinity,
    );
  const air = airTransmission(grid, obs.airmass);
  const fine = new Float64Array(grid.count);
  let nm = Math.exp(grid.lnStart);
  const ratio = Math.exp(grid.step);
  for (let i = 0; i < grid.count; i++) {
    const behind = obs.background === null ? 0 : planckRadiance(nm, obs.background);
    const source = planckRadiance(nm, obs.gas.temperature);
    const transmitted = Math.exp(-tau[i]!);
    fine[i] = (behind * transmitted + source * (1 - transmitted)) * air[i]!;
    nm *= ratio;
  }
  return observe(fine, grid, obs.resolution, from, to, samples, (x) =>
    obs.background === null ? 0 : planckRadiance(x, obs.background),
  );
}

/* ─── A star: layers of a model photosphere ─── */

type Cell = Conditions & {
  /** Mass of gas in the cell, kg m⁻². */
  mass: number;
  /** Continuum optical depth across the cell. */
  tau: number;
  /** log τ_Ross at the cell's middle. */
  logTau: number;
};

/** The model cut into cells between its depths, plus everything above the first one. */
function cellsOf(atmosphere: Photosphere, microturbulence: number): Cell[] {
  const { layers } = atmosphere;
  const top = layers[0]!;
  const cells: Cell[] = [
    {
      temperature: top.temperature,
      electronPressure: top.electronPressure,
      gasPressure: top.gasPressure,
      microturbulence,
      mass: top.column,
      tau: 10 ** top.logTau,
      logTau: top.logTau - 0.5,
    },
  ];
  for (let i = 1; i < layers.length; i++) {
    const a = layers[i - 1]!;
    const b = layers[i]!;
    cells.push({
      temperature: (a.temperature + b.temperature) / 2,
      electronPressure: Math.sqrt(a.electronPressure * b.electronPressure),
      gasPressure: Math.sqrt(a.gasPressure * b.gasPressure),
      microturbulence,
      mass: b.column - a.column,
      tau: 10 ** b.logTau - 10 ** a.logTau,
      logTau: (a.logTau + b.logTau) / 2,
    });
  }
  return cells;
}

/** Atoms of an element in a kilogram of the star's gas. */
function atomsPerKilogram(element: ElementId, abundances?: Partial<Record<ElementId, number>>) {
  const hydrogen = HYDROGEN_MASS_FRACTION / (ELEMENTS.H.mass * ATOMIC_MASS_KG);
  return hydrogen * 10 ** (ELEMENTS[element].abundance + (abundances?.[element] ?? 0) - 12);
}

type StarLine = {
  line: Line;
  shape: Shape;
  /** τ per unit H(a, v) in each cell. */
  cells: Float64Array;
  /** Line-centre optical depth down to the continuum's τ = 1. */
  tau: number;
};

/** Every line the star forms, with its optical depth layer by layer. */
export function starLines(obs: StarObservation, only?: Line) {
  const cells = cellsOf(obs.photosphere, obs.microturbulence);
  const shift = dopplerFactor(obs.velocity);
  const shapeAt = {
    metal: { ...layerAt(obs.photosphere, SHAPE_DEPTH.metal), microturbulence: obs.microturbulence },
    hydrogen: {
      ...layerAt(obs.photosphere, SHAPE_DEPTH.hydrogen),
      microturbulence: obs.microturbulence,
    },
  };
  const out: StarLine[] = [];
  for (const line of only ? [only] : LINES) {
    const shape = lineShape(line, line.element === "H" ? shapeAt.hydrogen : shapeAt.metal, shift);
    const perAtom = atomsPerKilogram(line.element, obs.abundances);
    const norm = Math.sqrt(Math.PI) * (shape.doppler / shift) * 1e-9;
    const centre = voigt(shape.damping, 0);
    const opacity = new Float64Array(cells.length);
    let tau = 0;
    cells.forEach((cell, k) => {
      const value = (perAtom * cell.mass * lineCrossSection(line, cell)) / norm;
      opacity[k] = value;
      if (cell.logTau < 0) tau += value * centre;
    });
    if (only || tau > TAU_FLOOR) out.push({ line, shape, cells: opacity, tau });
  }
  return { cells, lines: out };
}

/**
 * Integrates the light up through the cells at one wavelength (along μ = 2/3), given the
 * Planck function of each cell, the line opacity in each (or null), and the source below.
 */
function emerge(
  source: Float64Array,
  cells: Cell[],
  lines: Float32Array | null,
  row: number,
  deep: number,
) {
  let tau = 0;
  let above = 1;
  let intensity = 0;
  for (let k = 0; k < cells.length; k++) {
    tau += cells[k]!.tau + (lines ? lines[row + k]! : 0);
    const below = Math.exp(-tau / MU);
    intensity += source[k]! * (above - below);
    above = below;
  }
  return intensity + deep * above;
}

/** Planck functions of every cell on a coarse wavelength grid, interpolated when used. */
function sourceTable(cells: Cell[], from: number, to: number, deepTemperature: number) {
  const step = 0.5;
  const start = from - 1;
  const count = Math.ceil((to + 1 - start) / step) + 1;
  const table = new Float64Array(count * (cells.length + 1));
  for (let g = 0; g < count; g++) {
    const nm = start + g * step;
    cells.forEach((cell, k) => {
      table[g * (cells.length + 1) + k] = planckRadiance(nm, cell.temperature);
    });
    table[g * (cells.length + 1) + cells.length] = planckRadiance(nm, deepTemperature);
  }
  const width = cells.length + 1;
  const row = new Float64Array(width);
  /** The cells' Planck functions at a wavelength; the last entry is the deep source's. */
  return (nm: number) => {
    const x = Math.min(count - 1.001, Math.max(0, (nm - start) / step));
    const g = Math.floor(x);
    const t = x - g;
    for (let k = 0; k < width; k++)
      row[k] = table[g * width + k]! * (1 - t) + table[(g + 1) * width + k]! * t;
    return row;
  };
}

function synthesizeStar(obs: StarObservation, from: number, to: number, samples: number) {
  const grid = gridFor(from, to, obs.resolution, MAX_FINE.star);
  const { cells, lines } = starLines(obs);
  const K = cells.length;
  const opacity = new Float32Array(grid.count * K);
  const touched = new Uint8Array(grid.count);
  for (const { shape, cells: perCell, tau } of lines)
    sweep({ ...shape, peak: tau }, grid, (i, h) => {
      touched[i] = 1;
      for (let k = 0; k < K; k++) opacity[i * K + k]! += perCell[k]! * h;
    });
  const deepTemperature = obs.photosphere.layers.at(-1)!.temperature;
  const sources = sourceTable(
    cells,
    Math.exp(grid.lnStart),
    Math.exp(grid.lnStart + grid.count * grid.step),
    deepTemperature,
  );
  const continuumAt = (nm: number) => {
    const s = sources(nm);
    return emerge(s, cells, null, 0, s[K]!);
  };
  const air = airTransmission(grid, obs.airmass);
  const fine = new Float64Array(grid.count);
  let nm = Math.exp(grid.lnStart);
  const ratio = Math.exp(grid.step);
  for (let i = 0; i < grid.count; i++) {
    const s = sources(nm);
    fine[i] =
      (touched[i] ? emerge(s, cells, opacity, i * K, s[K]!) : emerge(s, cells, null, 0, s[K]!)) *
      air[i]!;
    nm *= ratio;
  }
  return observe(fine, grid, obs.resolution, from, to, samples, continuumAt);
}

/** The spectrum between `from` and `to` nm in `samples` pixels. */
export function synthesize(obs: Observation, from: number, to: number, samples: number): Spectrum {
  return obs.kind === "slab"
    ? synthesizeSlab(obs, from, to, samples)
    : synthesizeStar(obs, from, to, samples);
}

/* ─── One line at a time ─── */

export type LineReport = {
  line: Line;
  shape: Shape;
  /** Optical depth at line centre (a star: down to the continuum's τ = 1). */
  tau: number;
  /** Equivalent width, nm; null for a gas seen against the dark. */
  equivalentWidth: number | null;
  /** Where the line sits on its curve of growth. */
  regime: "weak" | "saturated" | "damped";
  /** A star: the temperature where the line's core becomes opaque, K. */
  coreTemperature: number | null;
};

const regimeOf = (tau: number, damping: number) =>
  tau < 1 ? "weak" : (tau * damping) / Math.sqrt(Math.PI) > 10 ? "damped" : "saturated";

/**
 * How far to integrate a line's width: where its optical depth falls below 10⁻⁶, and past
 * the Lorentz wings that still hold a thousandth of a weak line's area (2a / πv of it lies
 * beyond v); never beyond `cap` nm.
 */
function integrationReach(p: Profile, cap: number) {
  const wings = (2 * p.damping) / (Math.PI * 1e-3);
  return Math.min(cap, Math.max(reach(p, 1e-6, cap), p.doppler * Math.max(6, wings)));
}

/** ∫ (1 − e^(−τ)) dλ over one line in a slab, nm. */
export function absorbedWidth(p: Profile) {
  return integrateLine(
    p.doppler,
    integrationReach(p, 1000),
    2001,
    (v) => -Math.expm1(-p.peak * shapeAt(p, v)),
  );
}

/**
 * ∫ f dλ across a line, nm, on points packed at its core and spread through its wings
 * (Δλ = Δλ_D sinh u, u even): the core is resolved however far the wings reach. `f` takes
 * the distance from centre in Doppler widths.
 */
function integrateLine(doppler: number, width: number, points: number, f: (v: number) => number) {
  const top = Math.asinh(width / doppler);
  const du = (2 * top) / (points - 1);
  let sum = 0;
  for (let i = 0; i < points; i++) {
    const u = -top + i * du;
    const weight = i === 0 || i === points - 1 ? 0.5 : 1;
    sum += weight * f(Math.sinh(u)) * Math.cosh(u);
  }
  return sum * du * doppler;
}

/** A star's equivalent width of one line alone, nm, by the same integration as the spectrum. */
function starWidth(obs: StarObservation, line: Line) {
  const { cells, lines } = starLines(obs, line);
  const one = lines[0]!;
  const K = cells.length;
  const width = integrationReach({ ...one.shape, peak: one.tau }, 30);
  const sources = sourceTable(
    cells,
    one.shape.centre - width,
    one.shape.centre + width,
    obs.photosphere.layers.at(-1)!.temperature,
  );
  const s = sources(one.shape.centre);
  const continuum = emerge(s, cells, null, 0, s[K]!);
  const row = new Float32Array(K);
  const sum = integrateLine(one.shape.doppler, width, 801, (v) => {
    const h = shapeAt(one.shape, v);
    for (let k = 0; k < K; k++) row[k] = one.cells[k]! * h;
    return 1 - emerge(s, cells, row, 0, s[K]!) / continuum;
  });
  /* Where the core reaches τ = μ: the layer the core's light comes from. */
  let tau = 0;
  let coreTemperature = cells.at(-1)!.temperature;
  const centre = voigt(one.shape.damping, 0);
  for (let k = 0; k < K; k++) {
    tau += cells[k]!.tau + one.cells[k]! * centre;
    if (tau >= MU) {
      coreTemperature = cells[k]!.temperature;
      break;
    }
  }
  return { one, width: sum, coreTemperature };
}

/** One line's strength in this observation, as if no other line were there. */
export function reportLine(line: Line, obs: Observation): LineReport | null {
  if (obs.kind === "star") {
    const { one, width, coreTemperature } = starWidth(obs, line);
    return {
      line,
      shape: one.shape,
      tau: one.tau,
      equivalentWidth: width,
      regime: regimeOf(one.tau, one.shape.damping),
      coreTemperature,
    };
  }
  const profile = lineProfile(line, obs.gas, dopplerFactor(obs.velocity));
  if (!profile) return null;
  const tau = profile.peak * voigt(profile.damping, 0);
  let equivalentWidth: number | null = null;
  if (obs.background !== null) {
    const behind = planckRadiance(line.wavelength, obs.background);
    const source = planckRadiance(line.wavelength, obs.gas.temperature);
    equivalentWidth = (1 - source / behind) * absorbedWidth(profile);
  }
  return {
    line,
    shape: profile,
    tau,
    equivalentWidth,
    regime: regimeOf(tau, profile.damping),
    coreTemperature: null,
  };
}

/**
 * The curve of growth: how a line's strength grows with the number of its atoms, from a
 * ten-thousandth to a hundred times what the source holds. Points are [log₁₀ of that factor,
 * log₁₀ W / nm], W the width the line would absorb against a bright source. The slope falls
 * from 1 (weak) through ≈ 0 (saturated) to ½ (damped).
 */
export function curveOfGrowth(line: Line, obs: Observation, points = 25) {
  const out: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const exponent = -4 + (6 * i) / (points - 1);
    let width: number;
    if (obs.kind === "star") {
      const abundances = {
        ...obs.abundances,
        [line.element]: (obs.abundances?.[line.element] ?? 0) + exponent,
      };
      width = starWidth({ ...obs, abundances }, line).width;
    } else {
      const profile = lineProfile(line, obs.gas, 1);
      if (!profile) return [];
      width = absorbedWidth({ ...profile, peak: profile.peak * 10 ** exponent });
    }
    if (width > 0) out.push([exponent, Math.log10(width)]);
  }
  return out;
}

/** The depth of the spectrum at a wavelength, against its continuum (0 none, 1 black). */
export function depthAt(spectrum: Spectrum, nm: number) {
  const { wavelengths, flux, continuum } = spectrum;
  const n = wavelengths.length;
  const from = wavelengths[0]!;
  const to = wavelengths[n - 1]!;
  if (nm < from || nm > to || n < 2) return 0;
  const x = ((nm - from) / (to - from)) * (n - 1);
  const i = Math.min(n - 2, Math.floor(x));
  const t = x - i;
  const f = flux[i]! * (1 - t) + flux[i + 1]! * t;
  const c = continuum[i]! * (1 - t) + continuum[i + 1]! * t;
  return c > 0 ? 1 - f / c : 0;
}

/** The lines an observation forms, strongest first, with their observed centres. */
export function formedLines(obs: Observation) {
  const list =
    obs.kind === "slab"
      ? slabProfiles(obs).map(({ line, profile }) => ({
          line,
          centre: profile.centre,
          tau: profile.peak * voigt(profile.damping, 0),
        }))
      : starLines(obs).lines.map(({ line, shape, tau }) => ({ line, centre: shape.centre, tau }));
  return list.sort((a, b) => b.tau - a.tau);
}
