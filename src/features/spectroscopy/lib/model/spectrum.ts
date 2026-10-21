import { airToVacuum, dopplerWavelengthRatio, planckRadiance } from "@horizon/toolkit/science";

import { layerAt, type Photosphere } from "./atmospheres";
import { ELEMENT_IDS, LINES, type ElementId, type Line } from "./atoms";
import {
  continuumOf,
  continuumWavelength,
  totalOpacity,
  type ContinuumWavelength,
} from "./continuum";
import { atomsPerKilogram } from "./populations";
import {
  lineCrossSection,
  lineProfile,
  lineShape,
  reach,
  shapeAt,
  shifted,
  type Conditions,
  type Gas,
  type Profile,
  type Shape,
} from "./profile";
import { recentCache } from "./recent";
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
 * local thermodynamic equilibrium at its own temperature and pressure, its continuum opacity
 * worked out at each wavelength from H⁻, hydrogen and free electrons (`continuum`). The
 * emergent flux is taken in the Eddington–Barbier approximation, F ≈ π I(μ = 2/3). It is
 * worked out at rest and kept (`starModel`): the star's velocity moves its whole spectrum, so
 * a slider or a dragged window costs no new radiative transfer. Its lines' widths are
 * measured at rest too.
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
  /**
   * What reaches the detector: the bench's intensity, W m⁻² sr⁻¹ m⁻¹, or a star's surface
   * flux, W m⁻² m⁻¹ (πI at μ = 2/3).
   */
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
/** Where a line's reference shape is taken; hydrogen's (whose wings form deep) serves every cell. */
const SHAPE_DEPTH = { metal: -1, hydrogen: -0.5 };

/** Planck's law at a spectrum's air wavelength, evaluated (as it is defined) in vacuum. */
const planck = (air: number, kelvin: number) => planckRadiance(airToVacuum(air), kelvin);

/**
 * Light through a uniform slab: what shines `behind` it dimmed by e^(−τ), plus the slab's own
 * `source` function for the rest, I = I₀ e^(−τ) + B (1 − e^(−τ)). Kirchhoff's laws in one line;
 * the printed equation (`equations.ts`) computes from this too.
 */
export function slabIntensity(behind: number, source: number, tau: number) {
  const transmitted = Math.exp(-tau);
  return behind * transmitted + source * (1 - transmitted);
}

type Grid = { lnStart: number; step: number; count: number };

function gridFor(from: number, to: number, resolution: number, max: number): Grid {
  const sigma = 1 / (resolution * FWHM_PER_SIGMA);
  const lnStart = Math.log(from) - 5 * sigma;
  const lnEnd = Math.log(to) + 5 * sigma;
  const count = Math.min(max, Math.ceil((lnEnd - lnStart) / FINE_STEP));
  return { lnStart, step: (lnEnd - lnStart) / count, count };
}

/** Calls `visit(i, nm)` at the grid's samples `first` through `last`, walking the log grid. */
function forEachSample(
  grid: Grid,
  visit: (i: number, nm: number) => void,
  first = 0,
  last = grid.count - 1,
) {
  const ratio = Math.exp(grid.step);
  let nm = Math.exp(grid.lnStart + first * grid.step);
  for (let i = first; i <= last; i++) {
    visit(i, nm);
    nm *= ratio;
  }
}

/**
 * Calls `visit(i, offset)` at every grid sample the profile reaches, offset from centre in nm,
 * out to at most `cap` widths.
 */
function sweep(p: Profile, grid: Grid, visit: (i: number, offset: number) => void, cap = 40) {
  const width = reach(p, TAU_FLOOR, cap);
  /* Wings wider than the line's own wavelength start at the grid's first sample, not at λ ≤ 0. */
  const blue = p.centre - width;
  const first = blue > 0 ? Math.max(0, Math.ceil((Math.log(blue) - grid.lnStart) / grid.step)) : 0;
  const last = Math.min(
    grid.count - 1,
    Math.floor((Math.log(p.centre + width) - grid.lnStart) / grid.step),
  );
  forEachSample(grid, (i, nm) => visit(i, nm - p.centre), first, last);
}

function airTransmission(grid: Grid, airmass: number) {
  const tau = new Float64Array(grid.count);
  if (airmass > 0)
    for (const p of TELLURIC)
      sweep({ ...p, peak: p.peak * airmass }, grid, (i, offset) => {
        tau[i]! += p.peak * airmass * shapeAt(p, offset / p.doppler);
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

/**
 * What both sources share once their light is known: `intensityAt(i, nm)` on the fine grid,
 * through Earth's air, then the instrument (`observe`), with `continuumAt` for the plot.
 */
function render(
  grid: Grid,
  obs: Instrument,
  from: number,
  to: number,
  samples: number,
  intensityAt: (i: number, nm: number) => number,
  continuumAt: (nm: number) => number,
): Spectrum {
  const air = airTransmission(grid, obs.airmass);
  const fine = new Float64Array(grid.count);
  forEachSample(grid, (i, nm) => {
    fine[i] = intensityAt(i, nm) * air[i]!;
  });
  return observe(fine, grid, obs.resolution, from, to, samples, continuumAt);
}

/* ─── The lab: a uniform slab ─── */

/** Every line the slab's gas absorbs, with its profile at the source's velocity. */
export function slabProfiles(obs: SlabObservation) {
  const shift = dopplerWavelengthRatio(obs.velocity);
  const out: { line: Line; profile: Profile }[] = [];
  for (const line of LINES) {
    const profile = lineProfile(line, obs.gas, shift);
    if (profile && profile.peak * shapeAt(profile, 0) > TAU_FLOOR) out.push({ line, profile });
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
      (i, offset) => {
        tau[i]! += profile.peak * shapeAt(profile, offset / profile.doppler);
      },
      Infinity,
    );
  const continuumAt = (nm: number) => (obs.background === null ? 0 : planck(nm, obs.background));
  return render(
    grid,
    obs,
    from,
    to,
    samples,
    (i, nm) => slabIntensity(continuumAt(nm), planck(nm, obs.gas.temperature), tau[i]!),
    continuumAt,
  );
}

/* ─── A star: layers of a model photosphere ─── */

type Cell = Conditions & {
  /** Mass of gas in the cell, kg m⁻². */
  mass: number;
  /** The cell's continuum opacity at a wavelength, m² kg⁻¹. */
  opacity: (w: ContinuumWavelength) => number;
};

function cell(conditions: Conditions, mass: number): Cell {
  const parts = continuumOf(conditions);
  return { ...conditions, mass, opacity: (w) => totalOpacity(parts(w)) };
}

/** The model cut into cells between its depths, plus everything above the first one. */
function cellsOf(atmosphere: Photosphere, microturbulence: number): Cell[] {
  const { layers } = atmosphere;
  const top = layers[0]!;
  const cells: Cell[] = [
    cell(
      {
        temperature: top.temperature,
        electronPressure: top.electronPressure,
        gasPressure: top.gasPressure,
        microturbulence,
      },
      top.column,
    ),
  ];
  for (let i = 1; i < layers.length; i++) {
    const a = layers[i - 1]!;
    const b = layers[i]!;
    const conditions = {
      temperature: (a.temperature + b.temperature) / 2,
      electronPressure: Math.sqrt(a.electronPressure * b.electronPressure),
      gasPressure: Math.sqrt(a.gasPressure * b.gasPressure),
      microturbulence,
    };
    cells.push(cell(conditions, b.column - a.column));
  }
  return cells;
}

/**
 * The cells at one wavelength, as one row: the Planck function of each, then the source below
 * them all, then each cell's continuum optical depth.
 */
function columnAt(cells: Cell[], nm: number, deepTemperature: number) {
  const K = cells.length;
  const row = new Float64Array(2 * K + 1);
  const w = continuumWavelength(nm);
  cells.forEach((cell, k) => {
    row[k] = planck(nm, cell.temperature);
    row[K + 1 + k] = cell.opacity(w) * cell.mass;
  });
  row[K] = planck(nm, deepTemperature);
  return row;
}

/** The rows' spacing in the column table, nm: the Planck functions and continuum vary slowly. */
const COLUMN_STEP = 0.5;

/** Two rows of the cells (`columnAt`) and a wavelength `t` of the way from the first to the second. */
type Between = { below: Float64Array; above: Float64Array; t: number };

/**
 * The cells' rows at wavelengths `COLUMN_STEP` apart, each with the continuum flux it gives,
 * worked out the first time a wavelength near it is asked for; between rows, both are
 * interpolated.
 */
function columnTable(cells: Cell[], deepTemperature: number) {
  const K = cells.length;
  const rows = new Map<number, { row: Float64Array; continuum: number }>();
  const rowAt = (g: number) => {
    let known = rows.get(g);
    if (!known) {
      const row = columnAt(cells, g * COLUMN_STEP, deepTemperature);
      known = { row, continuum: emerge({ below: row, above: row, t: 0 }, K, null, 0) };
      rows.set(g, known);
    }
    return known;
  };
  return {
    /** Fills `out` with the rows either side of `nm`. */
    between(nm: number, out: Between) {
      const x = nm / COLUMN_STEP;
      const g = Math.floor(x);
      out.below = rowAt(g).row;
      out.above = rowAt(g + 1).row;
      out.t = x - g;
      return out;
    },
    /** The continuum's surface flux at `nm`. */
    continuum(nm: number) {
      const x = nm / COLUMN_STEP;
      const g = Math.floor(x);
      const below = rowAt(g).continuum;
      return below + (x - g) * (rowAt(g + 1).continuum - below);
    },
  };
}

/** What a star's cells are, whatever its lines: they depend on its model and microturbulence alone. */
type Cells = {
  cells: Cell[];
  /** The temperature of the source below them all, K. */
  deepTemperature: number;
  /** The cells' rows by wavelength (`columnTable`). */
  columns: ReturnType<typeof columnTable>;
  /** The conditions a line's reference shape is taken at (`SHAPE_DEPTH`). */
  reference: { metal: Conditions; hydrogen: Conditions };
};

const cellsByModel = new WeakMap<Photosphere, Map<number, Cells>>();

/** The star's cells, worked out once per model and microturbulence. */
function cellsFor(photosphere: Photosphere, microturbulence: number): Cells {
  let byTurbulence = cellsByModel.get(photosphere);
  if (!byTurbulence) cellsByModel.set(photosphere, (byTurbulence = new Map()));
  let known = byTurbulence.get(microturbulence);
  if (!known) {
    const cells = cellsOf(photosphere, microturbulence);
    const deepTemperature = photosphere.layers.at(-1)!.temperature;
    const at = (depth: number) => ({ ...layerAt(photosphere, depth), microturbulence });
    known = {
      cells,
      deepTemperature,
      columns: columnTable(cells, deepTemperature),
      reference: { metal: at(SHAPE_DEPTH.metal), hydrogen: at(SHAPE_DEPTH.hydrogen) },
    };
    byTurbulence.set(microturbulence, known);
  }
  return known;
}

/**
 * Within this many Doppler widths (or Lorentz half-widths, if wider) of its centre, a line's
 * opacity in each cell is its own Voigt function; beyond, its Lorentz wings,
 * H ≈ (a / √π v²)(1 + (3/2 − a²) / v²), good there to better than 1 %.
 */
const CORE_REACH = 5;

/** A line in a star, at rest: the source's velocity moves the whole spectrum (`synthesizeStar`). */
type StarLine = {
  line: Line;
  /** The line's shape at one depth: its centre, and what the line card shows. */
  shape: Shape;
  /** Each cell's τ per unit H(a, v), its Doppler width (nm) and damping a. */
  strength: Float64Array;
  doppler: Float64Array;
  damping: Float64Array;
  /** Each cell's Lorentz wings, τ ≈ wing / Δλ² + wing2 / Δλ⁴ (Δλ in nm). */
  wing: Float64Array;
  wing2: Float64Array;
  /** How far from centre, nm, the cells take their full Voigt functions. */
  core: number;
  /** Hydrogen keeps one shape, its Stark wings, through every cell. */
  frozen: boolean;
  /** Line-centre optical depth down to the continuum's τ = 1. */
  tau: number;
  /** One profile that reaches as far as the cells' together, for finding the line's span. */
  extent: Profile;
};

/** Adds the line's opacity in each cell, `offset` nm from its centre, to `out` from `at`. */
function addLine(sl: StarLine, offset: number, out: Float32Array, at: number) {
  const K = sl.strength.length;
  if (sl.frozen) {
    const h = shapeAt(sl.shape, offset / sl.shape.doppler);
    for (let k = 0; k < K; k++) out[at + k]! += sl.strength[k]! * h;
  } else if (Math.abs(offset) > sl.core) {
    const inv = 1 / (offset * offset);
    for (let k = 0; k < K; k++) out[at + k]! += inv * (sl.wing[k]! + sl.wing2[k]! * inv);
  } else
    for (let k = 0; k < K; k++)
      out[at + k]! += sl.strength[k]! * voigt(sl.damping[k]!, offset / sl.doppler[k]!);
}

/**
 * A line's optical depth in the star, cell by cell, for `perAtom` of its atoms per kilogram.
 * Each cell broadens a metal line by its own temperature and pressures; hydrogen's shape is
 * taken at one depth.
 */
function starLine({ cells, reference }: Cells, line: Line, perAtom: number): StarLine {
  const K = cells.length;
  const frozen = line.element === "H";
  const shape = lineShape(line, frozen ? reference.hydrogen : reference.metal);
  const w = continuumWavelength(line.wavelength);
  const strength = new Float64Array(K);
  const doppler = new Float64Array(K);
  const damping = new Float64Array(K);
  const wing = new Float64Array(K);
  const wing2 = new Float64Array(K);
  let core = 0;
  let tau = 0;
  let wings = 0;
  let continuum = 0;
  cells.forEach((cell, k) => {
    const own = frozen ? shape : lineShape(line, cell);
    const d = own.doppler;
    const a = own.damping;
    const s =
      (perAtom * cell.mass * lineCrossSection(line, cell)) / (Math.sqrt(Math.PI) * d * 1e-9);
    const lorentz = (s * a * d * d) / Math.sqrt(Math.PI);
    strength[k] = s;
    doppler[k] = d;
    damping[k] = a;
    wing[k] = lorentz;
    wing2[k] = lorentz * (1.5 - a * a) * d * d;
    core = Math.max(core, CORE_REACH * d * Math.max(1, a));
    const step = cell.opacity(w) * cell.mass;
    if (continuum + step / 2 < 1) {
      tau += s * (frozen ? shapeAt(shape, 0) : voigt(a, 0));
      wings += lorentz;
    }
    continuum += step;
  });
  /* The single profile with the same centre depth and the same wings. */
  const extent = {
    ...shape,
    peak: tau,
    damping: tau > 0 ? (Math.sqrt(Math.PI) * wings) / (tau * shape.doppler ** 2) : shape.damping,
  };
  return { line, shape, strength, doppler, damping, wing, wing2, core, frozen, tau, extent };
}

/**
 * The line with `factor` times its atoms: every cell's opacity scales with them, its widths
 * do not.
 */
function scaledLine(sl: StarLine, factor: number): StarLine {
  const times = (values: Float64Array) => values.map((v) => v * factor);
  return {
    ...sl,
    strength: times(sl.strength),
    wing: times(sl.wing),
    wing2: times(sl.wing2),
    tau: sl.tau * factor,
    extent: { ...sl.extent, peak: sl.extent.peak * factor },
  };
}

/**
 * Integrates the light up through the cells at one wavelength (along μ = 2/3), given
 * their rows from `columnAt` (interpolated between two) and the line opacity in each (or
 * null): the surface flux.
 */
function emerge(
  { below, above: next, t }: Between,
  K: number,
  lines: Float32Array | null,
  offset: number,
) {
  let tau = 0;
  let above = 1;
  let intensity = 0;
  for (let k = 0, j = K + 1; k < K; k++, j++) {
    tau += below[j]! + t * (next[j]! - below[j]!) + (lines ? lines[offset + k]! : 0);
    const deeper = Math.exp(-tau / MU);
    intensity += (below[k]! + t * (next[k]! - below[k]!)) * (above - deeper);
    above = deeper;
  }
  const deep = below[K]! + t * (next[K]! - below[K]!);
  /* Eddington–Barbier: the surface flux is π times the intensity along μ = 2/3. */
  return Math.PI * (intensity + deep * above);
}

/** Line opacity on a grid: each cell's, sample by sample, and which samples any line reaches. */
function lineOpacity(K: number, lines: readonly StarLine[], grid: Grid) {
  const opacity = new Float32Array(grid.count * K);
  const touched = new Uint8Array(grid.count);
  for (const sl of lines)
    sweep(sl.extent, grid, (i, offset) => {
      touched[i] = 1;
      addLine(sl, offset, opacity, i * K);
    });
  return { opacity, touched };
}

/** The surface flux at rest on a grid, through the cells and `lines`. */
function emergentFlux({ cells, columns }: Cells, lines: readonly StarLine[], grid: Grid) {
  const K = cells.length;
  const { opacity, touched } = lineOpacity(K, lines, grid);
  const flux = new Float32Array(grid.count);
  const rows: Between = { below: new Float64Array(), above: new Float64Array(), t: 0 };
  forEachSample(grid, (i, nm) => {
    flux[i] = touched[i]
      ? emerge(columns.between(nm, rows), K, opacity, i * K)
      : columns.continuum(nm);
  });
  return flux;
}

/**
 * A star's spectrum is worked out at rest, on a lattice in ln λ: samples at whole multiples of
 * `FINE_STEP` · 2^level, the level the coarsest a window needs (`MAX_FINE`). A velocity only
 * moves the lattice (ln λ_observed = ln λ_rest + ln(λ/λ₀)), and a window that slides or a
 * velocity that changes reuses what was worked out: the lattice is kept in chunks of this many
 * samples, each filled the first time a window reaches it.
 */
const CHUNK = 2048;

type StarModel = Cells & {
  /** Every line the star forms, at rest. */
  lines: StarLine[];
  /** Surface flux at rest, display precision, by level and then by chunk. */
  lattices: Map<number, Map<number, Float32Array>>;
};

/** Star models kept with their lattices: the one in view and the few a visit switches between. */
const MODELS_KEPT = 4;
const starModels = recentCache<string, StarModel>(MODELS_KEPT);
/** Photospheres are told apart by identity (`starPhotosphere` gives the same object each time). */
const photosphereIds = new WeakMap<Photosphere, number>();
let photospheresSeen = 0;

/** The star's model: its cells, lines and lattices, by everything they depend on. */
function starModel(obs: StarObservation): StarModel {
  let id = photosphereIds.get(obs.photosphere);
  if (id === undefined) photosphereIds.set(obs.photosphere, (id = photospheresSeen++));
  const abundances = ELEMENT_IDS.map((element) => obs.abundances?.[element] ?? 0).join();
  return starModels(`${id}|${obs.microturbulence}|${abundances}`, () => {
    const cells = cellsFor(obs.photosphere, obs.microturbulence);
    const lines: StarLine[] = [];
    for (const line of LINES) {
      const sl = starLine(
        cells,
        line,
        atomsPerKilogram(line.element, obs.abundances?.[line.element]),
      );
      if (sl.tau > TAU_FLOOR) lines.push(sl);
    }
    return { ...cells, lines, lattices: new Map() };
  });
}

/** A star's fine grid for a window: on the lattice at rest, moved by the source's `shift`. */
type LatticeGrid = Grid & { level: number; first: number };

function latticeFor(from: number, to: number, resolution: number, shift: number): LatticeGrid {
  const sigma = 1 / (resolution * FWHM_PER_SIGMA);
  const lnShift = Math.log(shift);
  const lo = Math.log(from) - 5 * sigma - lnShift;
  const hi = Math.log(to) + 5 * sigma - lnShift;
  for (let level = 0; ; level++) {
    const step = FINE_STEP * 2 ** level;
    const first = Math.floor(lo / step);
    const count = Math.ceil(hi / step) - first + 1;
    if (count <= MAX_FINE.star)
      return { lnStart: first * step + lnShift, step, count, level, first };
  }
}

/** The surface flux at rest on the grid's samples, from the model's lattice. */
function latticeFlux(model: StarModel, { level, first, count, step }: LatticeGrid) {
  let chunks = model.lattices.get(level);
  if (!chunks) model.lattices.set(level, (chunks = new Map()));
  const flux = new Float32Array(count);
  for (let c = Math.floor(first / CHUNK); c * CHUNK < first + count; c++) {
    let chunk = chunks.get(c);
    if (!chunk) {
      chunk = emergentFlux(model, model.lines, { lnStart: c * CHUNK * step, step, count: CHUNK });
      chunks.set(c, chunk);
    }
    const from = Math.max(first, c * CHUNK);
    const to = Math.min(first + count, (c + 1) * CHUNK);
    flux.set(chunk.subarray(from - c * CHUNK, to - c * CHUNK), from - first);
  }
  return flux;
}

/** The star's continuum flux at an observed wavelength. */
const starContinuum = (model: StarModel, shift: number) => (nm: number) =>
  model.columns.continuum(nm / shift);

function synthesizeStar(obs: StarObservation, from: number, to: number, samples: number) {
  const model = starModel(obs);
  const shift = dopplerWavelengthRatio(obs.velocity);
  const grid = latticeFor(from, to, obs.resolution, shift);
  const flux = latticeFlux(model, grid);
  return render(grid, obs, from, to, samples, (i) => flux[i]!, starContinuum(model, shift));
}

/**
 * The star's spectrum without each element's lines, from the same lattice: opacities add, so
 * where an element's lines reach, their opacity is taken back out and the light worked out
 * again; everywhere else the spectrum is the same.
 */
function starWithout(
  obs: StarObservation,
  from: number,
  to: number,
  samples: number,
  elements: readonly ElementId[],
) {
  const model = starModel(obs);
  const K = model.cells.length;
  const shift = dopplerWavelengthRatio(obs.velocity);
  const grid = latticeFor(from, to, obs.resolution, shift);
  const base = latticeFlux(model, grid);
  /* The lines sit at rest on the lattice: the same samples, without the shift. */
  const atRest: Grid = { ...grid, lnStart: grid.first * grid.step };
  const all = lineOpacity(K, model.lines, atRest).opacity;
  const continuumAt = starContinuum(model, shift);
  const out = new Map<ElementId, Spectrum>();
  const others = new Float32Array(K);
  const rows: Between = { below: new Float64Array(), above: new Float64Array(), t: 0 };
  for (const element of elements) {
    const own = lineOpacity(
      K,
      model.lines.filter((sl) => sl.line.element === element),
      atRest,
    );
    const flux = base.slice();
    forEachSample(atRest, (i, nm) => {
      if (!own.touched[i]) return;
      for (let k = 0; k < K; k++)
        others[k] = Math.max(0, all[i * K + k]! - own.opacity[i * K + k]!);
      flux[i] = emerge(model.columns.between(nm, rows), K, others, 0);
    });
    out.set(
      element,
      render(grid, obs, from, to, samples, (i) => flux[i]!, continuumAt),
    );
  }
  return out;
}

/** The spectrum between `from` and `to` nm in `samples` pixels. */
export function synthesize(obs: Observation, from: number, to: number, samples: number): Spectrum {
  return obs.kind === "slab"
    ? synthesizeSlab(obs, from, to, samples)
    : synthesizeStar(obs, from, to, samples);
}

/** The spectrum as `synthesize` gives it with each of `elements` taken out, by element. */
export function synthesizeWithout(
  obs: Observation,
  from: number,
  to: number,
  samples: number,
  elements: readonly ElementId[],
): Map<ElementId, Spectrum> {
  if (obs.kind === "star") return starWithout(obs, from, to, samples, elements);
  return new Map(
    elements.map((element) => {
      const columns = { ...obs.gas.columns };
      delete columns[element];
      return [element, synthesizeSlab({ ...obs, gas: { ...obs.gas, columns } }, from, to, samples)];
    }),
  );
}

/* ─── One line at a time ─── */

type LineReport = {
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
    integrationReach(p, Math.min(1000, p.centre)),
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

/**
 * One line alone in a star, at rest: its opacity cell by cell, and the cells' row at its
 * centre, where the continuum and source functions are taken across the whole line.
 */
function lineAlone(obs: StarObservation, line: Line) {
  const cells = cellsFor(obs.photosphere, obs.microturbulence);
  const one = starLine(cells, line, atomsPerKilogram(line.element, obs.abundances?.[line.element]));
  const column = columnAt(cells.cells, line.wavelength, cells.deepTemperature);
  const exact: Between = { below: column, above: column, t: 0 };
  const continuum = emerge(exact, cells.cells.length, null, 0);
  return { cells: cells.cells, one, column, exact, continuum };
}
type LineAlone = ReturnType<typeof lineAlone>;

/**
 * A star's equivalent width of the line alone (or of `one`, the line with more or fewer
 * atoms), nm at rest, by the same integration as the spectrum.
 */
function starWidth({ cells, exact, continuum, one: line }: LineAlone, one = line) {
  const K = cells.length;
  const row = new Float32Array(K);
  return integrateLine(one.shape.doppler, integrationReach(one.extent, 30), 801, (v) => {
    row.fill(0);
    addLine(one, v * one.shape.doppler, row, 0);
    return 1 - emerge(exact, K, row, 0) / continuum;
  });
}

/** Where the line's core reaches τ = μ: the temperature of the layer its light comes from, K. */
function coreTemperature({ cells, column, one }: LineAlone) {
  const K = cells.length;
  const row = new Float32Array(K);
  addLine(one, 0, row, 0);
  let tau = 0;
  for (let k = 0; k < K; k++) {
    tau += column[K + 1 + k]! + row[k]!;
    if (tau >= MU) return cells[k]!.temperature;
  }
  return cells.at(-1)!.temperature;
}

/** One line's strength in this observation, as if no other line were there. */
export function reportLine(line: Line, obs: Observation): LineReport | null {
  if (obs.kind === "star") {
    const alone = lineAlone(obs, line);
    const { one } = alone;
    return {
      line,
      shape: shifted(one.shape, dopplerWavelengthRatio(obs.velocity)),
      tau: one.tau,
      equivalentWidth: starWidth(alone),
      regime: regimeOf(one.tau, one.extent.damping),
      coreTemperature: coreTemperature(alone),
    };
  }
  const profile = lineProfile(line, obs.gas, dopplerWavelengthRatio(obs.velocity));
  if (!profile) return null;
  const tau = profile.peak * shapeAt(profile, 0);
  let equivalentWidth: number | null = null;
  if (obs.background !== null) {
    const behind = planck(line.wavelength, obs.background);
    const source = planck(line.wavelength, obs.gas.temperature);
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
  /* The line's opacity scales with its atoms, so it is worked out once and scaled. */
  const alone = obs.kind === "star" ? lineAlone(obs, line) : null;
  const profile = obs.kind === "slab" ? lineProfile(line, obs.gas) : null;
  if (!alone && !profile) return [];
  const out: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const exponent = -4 + (6 * i) / (points - 1);
    const factor = 10 ** exponent;
    const width = alone
      ? starWidth(alone, scaledLine(alone.one, factor))
      : absorbedWidth({ ...profile!, peak: profile!.peak * factor });
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

/** A glowing gas's brightness at a wavelength, against its brightest light in view. */
export function emissionAt(spectrum: Spectrum, nm: number) {
  const { wavelengths, flux, peak } = spectrum;
  const n = wavelengths.length;
  const x = ((nm - wavelengths[0]!) / (wavelengths[n - 1]! - wavelengths[0]!)) * (n - 1);
  const i = Math.round(x);
  return i >= 0 && i < n && peak > 0 ? flux[i]! / peak : 0;
}

/** The lines an observation forms, strongest first, with their observed centres. */
export function formedLines(obs: Observation) {
  const list =
    obs.kind === "slab"
      ? slabProfiles(obs).map(({ line, profile }) => ({
          line,
          centre: profile.centre,
          tau: profile.peak * shapeAt(profile, 0),
        }))
      : starModel(obs).lines.map(({ line, shape, tau }) => ({
          line,
          centre: shape.centre * dopplerWavelengthRatio(obs.velocity),
          tau,
        }));
  return list.sort((a, b) => b.tau - a.tau);
}
