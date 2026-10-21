/**
 * The ladder's rungs, smallest to largest: what each is and how it ends. Light: routes read
 * the ids. The figures are in `catalogue.ts`; the sizes the ladder lays out are in `ladder.ts`.
 */

/** Every rung, in the order the ladder climbs: by radius, a neutron star to TON 618's horizon. */
export const RUNG_IDS = [
  "neutron-star",
  "cygnus-x1",
  "sirius-b",
  "earth",
  "brown-dwarf",
  "jupiter",
  "trappist-1",
  "proxima",
  "sun",
  "sirius",
  "vega",
  "achernar",
  "sgr-a",
  "arcturus",
  "r136a1",
  "aldebaran",
  "rigel",
  "deneb",
  "antares",
  "betelgeuse",
  "uy-scuti",
  "vy-cma",
  "stephenson-2-18",
  "m87",
  "ton-618",
] as const;
export type RungId = (typeof RUNG_IDS)[number];

/** The Sun, the ruler everything is measured against, opens the lab. */
export const DEFAULT_RUNG: RungId = "sun";

/**
 * What a rung is: a star burning, a remnant (a dead star's core), a planet (a ruler, not a
 * star) or a black hole's horizon (no surface at all).
 */
export type RungKind = "star" | "remnant" | "planet" | "horizon";

/** How a star ends, as its card says it. */
export type Fate = "whiteDwarf" | "neutronStar" | "blackHole" | "neutronOrHole";

export type Rung = {
  id: RungId;
  kind: RungKind;
  /** MK spectral class, or the object's class where it has none. Not translated. */
  type: string;
  fate?: Fate;
};

const rung = (id: RungId, kind: RungKind, type: string, fate?: Fate): Rung =>
  fate ? { id, kind, type, fate } : { id, kind, type };

export const RUNGS: readonly Rung[] = [
  rung("neutron-star", "remnant", "Pulsar"),
  rung("cygnus-x1", "horizon", "Black hole"),
  rung("sirius-b", "remnant", "DA2"),
  rung("earth", "planet", "Planet"),
  rung("brown-dwarf", "star", "Brown dwarf"),
  rung("jupiter", "planet", "Planet"),
  rung("trappist-1", "star", "M8 V", "whiteDwarf"),
  rung("proxima", "star", "M5.5 Ve", "whiteDwarf"),
  rung("sun", "star", "G2 V", "whiteDwarf"),
  rung("sirius", "star", "A1 V", "whiteDwarf"),
  rung("vega", "star", "A0 Va", "whiteDwarf"),
  rung("achernar", "star", "B6 Vep", "whiteDwarf"),
  rung("sgr-a", "horizon", "Black hole"),
  rung("arcturus", "star", "K1.5 III", "whiteDwarf"),
  rung("r136a1", "star", "WN5h", "blackHole"),
  rung("aldebaran", "star", "K5 III", "whiteDwarf"),
  rung("rigel", "star", "B8 Ia", "neutronOrHole"),
  rung("deneb", "star", "A2 Ia", "neutronOrHole"),
  rung("antares", "star", "M1.5 Iab", "neutronOrHole"),
  rung("betelgeuse", "star", "M1–M2 Ia–ab", "neutronOrHole"),
  rung("uy-scuti", "star", "M4 Ia", "neutronOrHole"),
  rung("vy-cma", "star", "M5e Ia", "neutronOrHole"),
  rung("stephenson-2-18", "star", "M6", "neutronOrHole"),
  rung("m87", "horizon", "Black hole"),
  rung("ton-618", "horizon", "Black hole"),
];

export const rungIndex = (id: RungId) => RUNG_IDS.indexOf(id);
