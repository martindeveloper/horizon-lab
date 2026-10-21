/**
 * The stars of the shared catalogue on a Hertzsprung–Russell diagram: each one's temperature,
 * light and radius, and the band its luminosity class puts it in. Any simulation places the
 * stars it shows from here; `components/simulations/hr-diagram.tsx` draws them.
 */
import type { Fact } from "@/lib/facts";
import {
  SOLAR_TEFF_K,
  UNITS,
  convert,
  stefanBoltzmann,
  type UnitId,
} from "@horizon/toolkit/science";

import { NAMED_STARS, SPECTRAL_TYPES, type StellarFigures } from "./stellar";

export type StarId = keyof typeof NAMED_STARS;

/** The bands an HR diagram is read by, as a star's luminosity class names them. */
export const HR_GROUPS = ["whiteDwarfs", "mainSequence", "giants", "supergiants"] as const;
export type HrGroup = (typeof HR_GROUPS)[number];

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

const isUnitId = (unit: string): unit is UnitId => Object.hasOwn(UNITS, unit);
/** Whether an id names a star of the shared catalogue. */
export const isStarId = (id: string): id is StarId => Object.hasOwn(NAMED_STARS, id);

const inUnit = (fact: Fact, to: UnitId) => {
  if (!isUnitId(fact.unit)) throw new TypeError(`A plain ${fact.unit} has no ${to}`);
  return convert(central(fact), fact.unit, to);
};

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
  const R = radius ? inUnit(radius, "Rsun") : Math.sqrt(light) / (kelvin / SOLAR_TEFF_K) ** 2;
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
