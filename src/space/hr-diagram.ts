/**
 * The stars of the shared catalogue on a Hertzsprung–Russell diagram: each one's temperature,
 * light and radius, and the band its luminosity class puts it in. Any simulation places the
 * stars it shows from here; `components/simulations/hr-diagram.tsx` draws them.
 */
import type { Fact } from "@/lib/facts";
import {
  convertFigure,
  logGravityCgs,
  stefanBoltzmann,
  stellarRadius,
  surfaceGravity,
  type UnitId,
} from "@horizon/toolkit/science";

import { NAMED_STARS, SPECTRAL_TYPES, type StellarFigures } from "./stellar";

export type StarId = keyof typeof NAMED_STARS;

/** The bands an HR diagram is read by, as a star's luminosity class names them. */
export const HR_GROUPS = ["whiteDwarfs", "mainSequence", "giants", "supergiants"] as const;
export type HrGroup = (typeof HR_GROUPS)[number];

/**
 * Main-sequence classes by effective temperature, hot to cool: where each begins, K, halfway
 * between the last subtype of the class above and its own first (Pecaut & Mamajek 2013, as
 * updated: O9.5 V 31,900 / B0 V 31,400 … K9 V 3,930 / M0 V 3,850).
 */
export const SPECTRAL_CLASSES = [
  ["O", 31_650],
  ["B", 10_050],
  ["A", 7310],
  ["F", 5960],
  ["G", 5325],
  ["K", 3890],
  ["M", 0],
] as const;

/**
 * Stars cooler than this carry their heat to the surface by convection, so their faces boil
 * with granules; hotter ones are radiative and smooth (about the F-type stars' boundary), K.
 */
export const CONVECTIVE_BELOW_K = 7_000;

/** A main-sequence star's spectral class. */
export const spectralClass = (teff: number) =>
  SPECTRAL_CLASSES.find(([, from]) => teff >= from)?.[0] ?? "M";

/** MK luminosity classes: D a white dwarf, V the main sequence, III a giant, I a supergiant. */
const CLASSES: readonly (readonly [RegExp, HrGroup])[] = [
  [/^D/, "whiteDwarfs"],
  [/\bV[a-z]*$/, "mainSequence"],
  [/\bIII$/, "giants"],
  [/\bI[ab–]*$/, "supergiants"],
];

/** The band a spectral type's luminosity class names; none for a type without one. */
export const groupOfType = (type: string): HrGroup | undefined =>
  CLASSES.find(([pattern]) => pattern.test(type))?.[1];

/** A star on the diagram: its temperature (K), light (L☉), radius (R☉) and band. */
export type HrPoint = {
  id: StarId;
  kelvin: number;
  light: number;
  radius: number;
  group?: HrGroup;
};

/** A figure's central value, or its span's geometric middle where it has none. */
const central = (fact: Fact) => fact.value ?? Math.sqrt(fact.range[0] * fact.range[1]);

export const isStarId = (id: string): id is StarId => Object.hasOwn(NAMED_STARS, id);

const inUnit = (fact: Fact, to: UnitId) => convertFigure(central(fact), fact.unit, to);

/**
 * A star's surface gravity log₁₀ g (g in cm s⁻², as model atmospheres are gridded), from its
 * catalogued mass and equatorial radius; null without both.
 */
export function logSurfaceGravity(id: StarId) {
  const { mass, radius }: StellarFigures = NAMED_STARS[id];
  if (!mass || !radius) return null;
  return logGravityCgs(surfaceGravity.compute({ M: inUnit(mass, "kg"), R: inUnit(radius, "m") }));
}

/**
 * A star's place, where its temperature and either its light or its radius are catalogued:
 * the light from radius and temperature by Stefan–Boltzmann where it is not measured.
 */
function pointOf(id: StarId): HrPoint | null {
  const figures: StellarFigures = NAMED_STARS[id];
  const { teff, radius, luminosity } = figures;
  if (!teff || (!radius && !luminosity)) return null;
  const kelvin = central(teff);
  const light = luminosity
    ? inUnit(luminosity, "Lsun")
    : stefanBoltzmann.compute({ R: inUnit(radius!, "Rsun"), T: kelvin });
  const R = radius ? inUnit(radius, "Rsun") : stellarRadius.compute({ L: light, T: kelvin });
  const type = SPECTRAL_TYPES[id];
  const group = type ? groupOfType(type) : undefined;
  return group ? { id, kelvin, light, radius: R, group } : { id, kelvin, light, radius: R };
}

/** Every catalogued star that can stand on the diagram, by id. */
export const HR_POINTS: Readonly<Partial<Record<StarId, HrPoint>>> = Object.fromEntries(
  Object.keys(NAMED_STARS)
    .filter(isStarId)
    .flatMap((id) => {
      const point = pointOf(id);
      return point ? [[id, point]] : [];
    }),
);

/** The points for a list of stars, in its order, leaving out those the diagram cannot place. */
export const hrPointsOf = (ids: readonly StarId[]): HrPoint[] =>
  ids.flatMap((id) => (HR_POINTS[id] ? [HR_POINTS[id]] : []));
