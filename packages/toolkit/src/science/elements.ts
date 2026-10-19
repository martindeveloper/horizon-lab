/**
 * The periodic table from hydrogen to zinc (Z = 1–30): every element that is abundant in
 * stars, up to the iron peak. Each has its atomic number, symbol, English name (for code and
 * documents; hosts translate what they show), standard atomic weight, and place in the table.
 *
 * Atomic weights are IUPAC's (CIAAW 2021) abridged to five significant figures; elements whose
 * weight varies in nature with the source (H, Li, B, C, N, O, Mg, Si, S, Cl, Ar) take IUPAC's
 * conventional value.
 */

/** The block an element sits in: which subshell its outermost electrons fill. */
export type PeriodicBlock = "s" | "p" | "d" | "f";

export type ChemicalElement = {
  /** Atomic number Z: protons in the nucleus. */
  number: number;
  symbol: ElementSymbol;
  /** English name. */
  name: string;
  /** Standard atomic weight, u. */
  atomicWeight: number;
  /** Row of the table, 1–7. */
  period: number;
  /** Column of the table, 1–18 (IUPAC numbering). */
  group: number;
  block: PeriodicBlock;
};

export const ELEMENT_SYMBOLS = [
  "H",
  "He",
  "Li",
  "Be",
  "B",
  "C",
  "N",
  "O",
  "F",
  "Ne",
  "Na",
  "Mg",
  "Al",
  "Si",
  "P",
  "S",
  "Cl",
  "Ar",
  "K",
  "Ca",
  "Sc",
  "Ti",
  "V",
  "Cr",
  "Mn",
  "Fe",
  "Co",
  "Ni",
  "Cu",
  "Zn",
] as const;
export type ElementSymbol = (typeof ELEMENT_SYMBOLS)[number];

/** The noble gases close each period, so Z alone fixes the row. */
const PERIOD_ENDS = [2, 10, 18, 36, 54, 86, 118];

function element(
  number: number,
  symbol: ElementSymbol,
  name: string,
  atomicWeight: number,
  group: number,
): ChemicalElement {
  return {
    number,
    symbol,
    name,
    atomicWeight,
    period: PERIOD_ENDS.findIndex((end) => number <= end) + 1,
    group,
    /* Helium sits over the p block but fills an s shell. */
    block: number === 2 || group <= 2 ? "s" : group >= 13 ? "p" : "d",
  };
}

export const PERIODIC_TABLE: Record<ElementSymbol, ChemicalElement> = {
  H: element(1, "H", "Hydrogen", 1.008, 1),
  He: element(2, "He", "Helium", 4.0026, 18),
  Li: element(3, "Li", "Lithium", 6.94, 1),
  Be: element(4, "Be", "Beryllium", 9.0122, 2),
  B: element(5, "B", "Boron", 10.81, 13),
  C: element(6, "C", "Carbon", 12.011, 14),
  N: element(7, "N", "Nitrogen", 14.007, 15),
  O: element(8, "O", "Oxygen", 15.999, 16),
  F: element(9, "F", "Fluorine", 18.998, 17),
  Ne: element(10, "Ne", "Neon", 20.18, 18),
  Na: element(11, "Na", "Sodium", 22.99, 1),
  Mg: element(12, "Mg", "Magnesium", 24.305, 2),
  Al: element(13, "Al", "Aluminium", 26.982, 13),
  Si: element(14, "Si", "Silicon", 28.085, 14),
  P: element(15, "P", "Phosphorus", 30.974, 15),
  S: element(16, "S", "Sulfur", 32.06, 16),
  Cl: element(17, "Cl", "Chlorine", 35.45, 17),
  Ar: element(18, "Ar", "Argon", 39.95, 18),
  K: element(19, "K", "Potassium", 39.098, 1),
  Ca: element(20, "Ca", "Calcium", 40.078, 2),
  Sc: element(21, "Sc", "Scandium", 44.956, 3),
  Ti: element(22, "Ti", "Titanium", 47.867, 4),
  V: element(23, "V", "Vanadium", 50.942, 5),
  Cr: element(24, "Cr", "Chromium", 51.996, 6),
  Mn: element(25, "Mn", "Manganese", 54.938, 7),
  Fe: element(26, "Fe", "Iron", 55.845, 8),
  Co: element(27, "Co", "Cobalt", 58.933, 9),
  Ni: element(28, "Ni", "Nickel", 58.693, 10),
  Cu: element(29, "Cu", "Copper", 63.546, 11),
  Zn: element(30, "Zn", "Zinc", 65.38, 12),
};

/** Whether a string names an element in the table. */
export const isElementSymbol = (symbol: string): symbol is ElementSymbol =>
  (ELEMENT_SYMBOLS as readonly string[]).includes(symbol);
