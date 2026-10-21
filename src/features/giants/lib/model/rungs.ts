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

/** What a remnant or a substellar body is called, where its kind alone says too little. */
export type RungLabel = "pulsar" | "whiteDwarf" | "brownDwarf";

export type Rung = {
  id: RungId;
  kind: RungKind;
  label?: RungLabel;
  fate?: Fate;
};

const star = (id: RungId, fate?: Fate): Rung =>
  fate ? { id, kind: "star", fate } : { id, kind: "star" };

export const RUNGS: readonly Rung[] = [
  { id: "neutron-star", kind: "remnant", label: "pulsar" },
  { id: "cygnus-x1", kind: "horizon" },
  { id: "sirius-b", kind: "remnant", label: "whiteDwarf" },
  { id: "earth", kind: "planet" },
  { id: "brown-dwarf", kind: "star", label: "brownDwarf" },
  { id: "jupiter", kind: "planet" },
  star("trappist-1", "whiteDwarf"),
  star("proxima", "whiteDwarf"),
  star("sun", "whiteDwarf"),
  star("sirius", "whiteDwarf"),
  star("vega", "whiteDwarf"),
  star("achernar", "whiteDwarf"),
  { id: "sgr-a", kind: "horizon" },
  star("arcturus", "whiteDwarf"),
  star("r136a1", "blackHole"),
  star("aldebaran", "whiteDwarf"),
  star("rigel", "neutronOrHole"),
  star("deneb", "neutronOrHole"),
  star("antares", "neutronOrHole"),
  star("betelgeuse", "neutronOrHole"),
  star("uy-scuti", "neutronOrHole"),
  star("vy-cma", "neutronOrHole"),
  star("stephenson-2-18", "neutronOrHole"),
  { id: "m87", kind: "horizon" },
  { id: "ton-618", kind: "horizon" },
];

export const rungIndex = (id: RungId) => RUNG_IDS.indexOf(id);
