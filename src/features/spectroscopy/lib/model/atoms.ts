import { airToVacuum, PERIODIC_TABLE, type ChemicalElement } from "@horizon/toolkit/science";

import data from "./atomic-data.json";
import broadening from "./broadening.json";

/**
 * The atoms the lab knows (from the shared periodic table): the Sun's mix of them, their ionization stages and
 * the lines they absorb between 380 and 770 nm. Energies, partition functions and line data
 * come from the NIST Atomic Spectra Database (scripts/fetch-atomic-data.mjs); wavelengths are
 * in air, as astronomers quote them.
 */

export const ELEMENT_IDS = ["H", "He", "Li", "Na", "K", "Mg", "Ca", "Fe"] as const;
export type ElementId = (typeof ELEMENT_IDS)[number];

/** A periodic-table element (`@horizon/toolkit/science`) with what the lab adds about it. */
type Element = ChemicalElement & {
  id: ElementId;
  /** The Sun's photospheric abundance log ε = log(N / N_H) + 12 (Asplund et al. 2009). */
  abundance: number;
  /** Its spectra from the neutral atom up, as NIST names them ("Ca I", "Ca II", …). */
  stages: readonly string[];
};

const element = (id: ElementId, abundance: number, stages: readonly string[]): Element => ({
  ...PERIODIC_TABLE[id],
  id,
  abundance,
  stages,
});

export const ELEMENTS: Record<ElementId, Element> = {
  H: element("H", 12, ["H I", "H II"]),
  He: element("He", 10.93, ["He I", "He II", "He III"]),
  Li: element("Li", 1.05, ["Li I", "Li II"]),
  Na: element("Na", 6.24, ["Na I", "Na II"]),
  K: element("K", 5.03, ["K I", "K II"]),
  Mg: element("Mg", 7.6, ["Mg I", "Mg II", "Mg III"]),
  Ca: element("Ca", 6.34, ["Ca I", "Ca II", "Ca III"]),
  Fe: element("Fe", 7.5, ["Fe I", "Fe II", "Fe III"]),
};

type SpeciesData = { ionization: number; partition: number[] };
const SPECIES = data.species as Record<string, SpeciesData>;
const GRID: readonly number[] = data.grid;
const LOG_GRID = GRID.map(Math.log);

/** Energy needed to remove the next electron from this species, eV (NIST). */
export function ionizationEnergy(species: string) {
  const entry = SPECIES[species];
  if (!entry) throw new Error(`No ionization energy for ${species}`);
  return entry.ionization;
}

/**
 * The partition function U(T) = Σ g e^(−E/kT): how many ways the species can hold its energy.
 * Interpolated in ln T on NIST's levels; a bare nucleus or a closed-shell ion the table does not
 * list counts its ground state alone.
 */
export function partitionFunction(species: string, kelvin: number) {
  const entry = SPECIES[species];
  if (!entry) return species === "H II" || species === "He III" ? 1 : closedShell(species);
  const table = entry.partition;
  const x = Math.log(kelvin);
  if (x <= LOG_GRID[0]!) return table[0]!;
  const last = LOG_GRID.length - 1;
  if (x >= LOG_GRID[last]!) return table[last]!;
  let i = 1;
  while (LOG_GRID[i]! < x) i++;
  const t = (x - LOG_GRID[i - 1]!) / (LOG_GRID[i]! - LOG_GRID[i - 1]!);
  return table[i - 1]! + t * (table[i]! - table[i - 1]!);
}

/** Li II, Na II and K II have closed shells whose first excited levels lie above 20 eV. */
function closedShell(species: string) {
  if (["Li II", "Na II", "K II"].includes(species)) return 1;
  throw new Error(`No partition function for ${species}`);
}

export type Level = { configuration: string; term: string; j: string };

export type Line = {
  /** Stable key: species and wavelength, "na1-588.995". */
  id: string;
  element: ElementId;
  /** NIST spectrum name, "Na I". */
  species: string;
  /** 0 for the neutral atom, 1 once ionized, … */
  stage: number;
  /** Air wavelength, nm: where the line sits in a spectrum. */
  wavelength: number;
  /** Vacuum wavelength, nm: for the photon's energy and the line's physics. */
  vacuum: number;
  /** log₁₀ of the oscillator strength times the lower level's weight. */
  logGf: number;
  /** Energy of the lower and upper level above the ground state, eV. */
  lower: number;
  upper: number;
  lowerLevel: Level;
  upperLevel: Level;
  /** NIST's accuracy grade of the transition probability (AAA ≤ 0.3 % … E > 50 %). */
  accuracy: string;
  /**
   * Broadening by neutral hydrogen from Barklem, Piskunov & O'Mara (2000), where they list the
   * line: log₁₀ of the full width per atom at 10,000 K (rad s⁻¹ cm³) and its temperature
   * exponent (scripts/fetch-line-broadening.mjs).
   */
  hydrogenCollisions?: { logGamma: number; exponent: number };
};

type RawLine = [string, number, number, number, number, string, string, string];

const level = (raw: string): Level => {
  const [configuration = "", term = "", j = ""] = raw.split("|");
  return { configuration, term, j };
};

const isElement = (id: string | undefined): id is ElementId =>
  ELEMENT_IDS.some((known) => known === id);

const elementOf = (species: string) => {
  const id = species.split(" ")[0];
  if (!isElement(id)) throw new Error(`Unknown element in ${species}`);
  return id;
};

/** A row of the generated table, checked: species, λ, log gf, E_lower, E_upper, levels, grade. */
function rawLine(row: readonly (string | number)[]): RawLine {
  const [species, wavelength, logGf, lower, upper, lo, up, accuracy] = row;
  if (
    typeof species !== "string" ||
    typeof wavelength !== "number" ||
    typeof logGf !== "number" ||
    typeof lower !== "number" ||
    typeof upper !== "number" ||
    typeof lo !== "string" ||
    typeof up !== "string" ||
    typeof accuracy !== "string"
  )
    throw new Error(`Malformed line ${JSON.stringify(row)}`);
  return [species, wavelength, logGf, lower, upper, lo, up, accuracy];
}

const ROMAN = ["I", "II", "III"];

const COLLISIONS = new Map(
  broadening.lines.map((row) => {
    const [species, wavelength, logGamma, exponent] = row;
    if (
      typeof species !== "string" ||
      typeof wavelength !== "number" ||
      typeof logGamma !== "number" ||
      typeof exponent !== "number"
    )
      throw new Error(`Malformed broadening ${JSON.stringify(row)}`);
    return [`${species} ${wavelength}`, { logGamma, exponent }];
  }),
);

export const LINES: readonly Line[] = data.lines
  .map(rawLine)
  .map(([species, wavelength, logGf, lower, upper, lo, up, accuracy]): Line => {
    const element = elementOf(species);
    const collisions = COLLISIONS.get(`${species} ${wavelength}`);
    const stage = ROMAN.indexOf(species.split(" ")[1] ?? "");
    return {
      id: `${element.toLowerCase()}${stage + 1}-${wavelength.toFixed(3)}`,
      element,
      species,
      stage,
      wavelength,
      vacuum: airToVacuum(wavelength),
      logGf,
      lower,
      upper,
      lowerLevel: level(lo),
      upperLevel: level(up),
      accuracy,
      ...(collisions ? { hydrogenCollisions: collisions } : {}),
    };
  });

const BY_ID = new Map(LINES.map((line) => [line.id, line]));
export const lineById = (id: string) => BY_ID.get(id);

/**
 * How strong a laboratory line looks, log gf − θχ, at a temperature that suits its stage
 * (5,000, 10,000 and 30,000 K; hydrogen at 10,000 K): a ranking within an element that knows
 * nothing of the source in view.
 */
function labStrength(line: Line) {
  const kelvin = line.element === "H" ? 10_000 : ([5000, 10_000, 30_000][line.stage] ?? 30_000);
  return line.logGf - (5040 / kelvin) * line.lower;
}

/** How strong each laboratory line looks within its element, 0.25–1 (from `labStrength`). */
const markWeights = new Map<string, number>();
function markWeightsOf(element: ElementId) {
  const own = LINES.filter((line) => line.element === element);
  const top = Math.max(...own.map(labStrength));
  for (const line of own)
    markWeights.set(line.id, Math.max(0.25, 1 - (top - labStrength(line)) / 3));
}

/** A laboratory line's weight under the spectrum: 1 for its element's strongest, 0.25 at least. */
export function markWeight(line: Line) {
  if (!markWeights.has(line.id)) markWeightsOf(line.element);
  return markWeights.get(line.id) ?? 0.5;
}

/** The element measured on: the one picked, if still marked, else the one marked last. */
export const measuredElement = (compare: readonly ElementId[], measure: ElementId | null) =>
  measure && compare.includes(measure) ? measure : (compare.at(-1) ?? null);

/** The line of an element nearest a wavelength, for naming famous lines in code. */
export function lineNear(species: string, nm: number) {
  let best: Line | undefined;
  for (const line of LINES)
    if (
      line.species === species &&
      (!best || Math.abs(line.wavelength - nm) < Math.abs(best.wavelength - nm))
    )
      best = line;
  if (!best || Math.abs(best.wavelength - nm) > 0.05)
    throw new Error(`No ${species} line at ${nm}`);
  return best;
}

/**
 * Lines with a name of their own: Fraunhofer's letters (1814), and the ones every
 * spectroscopist knows, each with a note on what it tells (`notes.<key>` in the messages).
 */
export const NAMED: readonly { line: Line; letter?: string; note: string }[] = [
  { line: lineNear("Ca II", 393.366), letter: "K", note: "caK" },
  { line: lineNear("Ca II", 396.847), letter: "H", note: "caH" },
  { line: lineNear("H I", 410.17), letter: "h", note: "hDelta" },
  { line: lineNear("Ca I", 422.673), letter: "g", note: "ca4227" },
  { line: lineNear("Fe I", 430.79), letter: "G", note: "gBand" },
  { line: lineNear("H I", 434.05), note: "hGamma" },
  { line: lineNear("Fe I", 438.354), letter: "e", note: "fe4383" },
  { line: lineNear("He I", 447.15), note: "he4471" },
  { line: lineNear("Mg II", 448.113), note: "mg4481" },
  { line: lineNear("He II", 468.57), note: "he4686" },
  { line: lineNear("H I", 486.135), letter: "F", note: "hBeta" },
  { line: lineNear("Mg I", 517.268), letter: "b₂", note: "mgB" },
  { line: lineNear("Mg I", 518.36), letter: "b₁", note: "mgB" },
  { line: lineNear("Fe I", 527.036), letter: "E₂", note: "feE" },
  { line: lineNear("He I", 587.566), letter: "D₃", note: "heD3" },
  { line: lineNear("Na I", 588.995), letter: "D₂", note: "naD" },
  { line: lineNear("Na I", 589.592), letter: "D₁", note: "naD" },
  { line: lineNear("H I", 656.279), letter: "C", note: "hAlpha" },
  { line: lineNear("Li I", 670.781), note: "li6708" },
  { line: lineNear("K I", 766.49), note: "kI" },
];

export const namedLine = (id: string) => NAMED.find((n) => n.line.id === id);

/**
 * The lines each element's velocity can be measured on: strong, well-known lines clear of
 * Balmer lines, the neutral atom's and, where the ion's take over in hotter stars, the ion's.
 * An observer picks whichever the spectrum shows best (`measureLine`).
 */
const MEASURE_LINES: Record<ElementId, readonly Line[]> = {
  H: [lineNear("H I", 656.279)],
  He: [lineNear("He I", 587.562), lineNear("He II", 468.57)],
  Li: [lineNear("Li I", 670.776)],
  Na: [lineNear("Na I", 588.995)],
  K: [lineNear("K I", 766.49)],
  Mg: [lineNear("Mg I", 518.36), lineNear("Mg II", 448.113)],
  Ca: [lineNear("Ca I", 422.673), lineNear("Ca II", 393.366)],
  Fe: [lineNear("Fe I", 438.354), lineNear("Fe II", 516.903)],
};

/**
 * The element's measuring line for this spectrum: the first of its lines that shows clearly
 * (line-centre optical depth from `formed` at least ½), else the strongest. So the neutral
 * atom's line in cool stars, the ion's once the atoms are ionized, never a saturated trough
 * picked only for being deepest; nothing the visitor cannot already see.
 */
export function measureLine(element: ElementId, formed: readonly { line: Line; tau: number }[]) {
  const candidates = MEASURE_LINES[element];
  const depth = (line: Line) => formed.find((f) => f.line === line)?.tau ?? 0;
  return (
    candidates.find((line) => depth(line) >= 0.5) ??
    candidates.reduce((best, line) => (depth(line) > depth(best) ? line : best))
  );
}
