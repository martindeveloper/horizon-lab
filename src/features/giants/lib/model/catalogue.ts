/**
 * Every figure a Giants card prints, once: a value or a published span, a unit of the science
 * kit, a source from the shared bibliography and how it was checked. Measured figures come
 * from the shared catalogue of stars and holes (`src/space/stellar.ts`) and the planets'
 * figures; the rest (a luminosity from radius and temperature, a horizon from a mass, the
 * light's lap, the mean density) are derived through `equations.ts`, over every corner of
 * their inputs' spans, so a derived figure is never surer than what it comes from.
 */
import { factsOf, factSources, type Fact, type Value } from "@/lib/facts";
import type { SourceId } from "@/lib/sources";
import { bodyRecord } from "@/space/body-catalogue";
import { NAMED_STARS, type Engine, type StellarFigures } from "@/space/stellar";
import { recordFrom } from "@horizon/toolkit/records";
import {
  STANDARD_GRAVITY,
  convert,
  convertFigure,
  schwarzschildRadius,
  stefanBoltzmann,
  stellarRadius,
  surfaceGravity,
  type Range,
  type UnitId,
} from "@horizon/toolkit/science";

import { AIR_DENSITY, WATER_DENSITY } from "../parameters";
import { lightLap, oblateDensity } from "./equations";
import { teaspoonKg } from "./physics";
import { RUNG_IDS, rungById, type RungId } from "./rungs";

type Unit = Value["unit"];
type Show = NonNullable<Value["show"]>;

/** The figures a rung's card may print, measured or catalogued; derived ones are added below. */
type Measured = StellarFigures;

/** Each feature entry resolves its catalogue identity once for every consumer. */
const BODIES = recordFrom(RUNG_IDS, (id) => bodyRecord(rungById(id).body));
const MEASURED: Readonly<Record<RungId, Measured>> = recordFrom(
  RUNG_IDS,
  (id) => BODIES[id].figures,
);
export const spectralOf = (id: RungId) => BODIES[id].spectralType;
export const RUNG_ENGINES: Readonly<Record<RungId, Engine>> = recordFrom(RUNG_IDS, (id) => {
  const engine = BODIES[id].engine;
  if (!engine) throw new Error(`No catalogued energy source for ${id}`);
  return engine;
});

/* ------------------------------------------------------------------ derived */

/** Each end of a fact's spread, or its value alone. */
const ends = (fact: Fact): number[] =>
  fact.range ? [fact.range[0], fact.range[1]] : [fact.value!];

/**
 * A figure computed from others: its value from their values (when every input has one), its
 * spread from every corner of their spreads. `unit`, `source` and the note say what it is.
 */
function derive(
  inputs: readonly Fact[],
  compute: (...values: number[]) => number,
  base: { unit: Unit; source: SourceId; note: string; digits?: number; show?: Show },
): Fact {
  const corners = inputs.reduce<number[][]>(
    (sets, fact) => sets.flatMap((set) => ends(fact).map((end) => [...set, end])),
    [[]],
  );
  const results = corners.map((set) => compute(...set));
  const low = Math.min(...results);
  const high = Math.max(...results);
  const values = inputs.map((fact) => fact.value);
  const range: Range | undefined = high > low * (1 + 1e-9) ? [low, high] : undefined;
  const fact = {
    ...base,
    sources: [...new Set(inputs.flatMap(factSources))],
    status: "derived" as const,
  };
  if (values.every((value): value is number => value !== undefined)) {
    const value = compute(...values);
    /* A value at a span's corner can sit a hair outside it in floating point. */
    const spread: Range | undefined = range
      ? [Math.min(range[0], value), Math.max(range[1], value)]
      : undefined;
    return spread ? { ...fact, value, range: spread } : { ...fact, value };
  }
  if (!range) throw new Error(`${base.note}: a span-only figure needs a spread`);
  return { ...fact, range };
}

/** A figure of a fact in another unit of the same dimension (a length in metres, a mass in kg). */
export const inUnit = (fact: Fact, to: UnitId) => (value: number) =>
  convertFigure(value, fact.unit, to);
const metres = (fact: Fact) => inUnit(fact, "m");
const kilograms = (fact: Fact) => inUnit(fact, "kg");

/** What a rung's card can print: its measured figures and those that follow from them. */
export type RungFacts = Required<Pick<Measured, "radius">> &
  Measured & {
    /** Euclidean equatorial circumference / c, s; not an orbital time. */
    lap: Fact;
    /** Mean density over water's. */
    density?: Fact;
    /** How many times thinner than air, for a body whose mean density is below air's. */
    thinness?: Fact;
    /** A teaspoon's weight, kg: only for remnants, where it is astonishing. */
    teaspoon?: Fact;
    /** How many Suns' worth of light, where the card does not catalogue it. */
    luminosity?: Fact;
    /** How much wider at the equator than pole to pole, per cent: for a body flattened by its spin. */
    bulge?: Fact;
    /**
     * Gravity at the surface, m/s², and how it compares with Earth's standard gravity: how many
     * times stronger, or for a body whose pull is weaker, how many times weaker.
     */
    gravity?: Fact;
    gravityEarths?: Fact;
    gravityWeaker?: Fact;
  };

function figuresOf(id: RungId): RungFacts {
  const measured = MEASURED[id];
  const kind = rungById(id).kind;
  let radius = measured.radius;
  const { mass, teff } = measured;
  let luminosity = measured.luminosity;

  if (!radius && kind === "horizon" && mass)
    radius = derive(
      [mass],
      (M) => schwarzschildRadius.compute({ M: convert(M, "Msun", "kg") }) / 1e3,
      {
        unit: "km",
        source: mass.source,
        note: "horizon of a non-spinning hole of this mass, 2GM/c²",
        digits: 3,
      },
    );
  if (!radius && luminosity && teff)
    radius = derive([luminosity, teff], (L, T) => stellarRadius.compute({ L, T }), {
      unit: "Rsun",
      source: luminosity.source,
      note: "from luminosity and temperature by Stefan–Boltzmann",
      digits: 2,
    });
  if (!radius) throw new Error(`${id} has no radius`);

  if (!luminosity && teff && kind === "star" && radius.unit === "Rsun")
    luminosity = derive([radius, teff], (R, T) => stefanBoltzmann.compute({ R, T }), {
      unit: "Lsun",
      source: radius.source,
      note: "from radius and temperature by Stefan–Boltzmann",
      digits: 2,
    });

  const toM = metres(radius);
  const lap = derive([radius], (R) => lightLap.compute({ R: toM(R) }), {
    unit: "s",
    source: radius.source,
    note: "geometric circumference / c, 2πR/c; not a photon orbit or relativistic travel time",
    digits: 2,
  });
  const facts: RungFacts = { ...measured, radius, lap };
  if (luminosity) facts.luminosity = luminosity;
  /* A measured flattening carries its own spread; a polar radius derived from it would count
     the equatorial radius's spread twice. */
  const { flattening, polar } = measured;
  if (flattening)
    facts.bulge = derive([flattening], (f) => 100 * (f - 1), {
      unit: "ratio",
      source: flattening.source,
      note: "measured flattening (equatorial over polar radius), less one, in per cent",
      digits: 2,
    });
  else if (polar) {
    const toPolarM = metres(polar);
    facts.bulge = derive([radius, polar], (R, P) => 100 * (toM(R) / toPolarM(P) - 1), {
      unit: "ratio",
      source: polar.source,
      note: "equatorial over polar radius, less one, in per cent",
      digits: 2,
    });
  }
  if (mass && kind !== "horizon") {
    const g = (M: number, R: number) =>
      surfaceGravity.compute({ M: kilograms(mass)(M), R: toM(R) });
    const note = "GM/R² at the equatorial radius, without the spin's outward pull";
    facts.gravity = derive([mass, radius], g, {
      unit: "m/s2",
      source: mass.source,
      note,
      digits: 3,
    });
    if (drawn(facts.gravity) >= STANDARD_GRAVITY)
      facts.gravityEarths = derive([mass, radius], (M, R) => g(M, R) / STANDARD_GRAVITY, {
        unit: "ratio",
        source: mass.source,
        note: `${note}, over standard gravity (${STANDARD_GRAVITY} m/s²)`,
        digits: 2,
      });
    else
      facts.gravityWeaker = derive([mass, radius], (M, R) => STANDARD_GRAVITY / g(M, R), {
        unit: "ratio",
        source: mass.source,
        note: `standard gravity (${STANDARD_GRAVITY} m/s²) over ${note}`,
        digits: 2,
      });
    const toKg = kilograms(mass);
    const polar = measured.polar;
    const toPolarM = polar ? metres(polar) : toM;
    const inputs = polar ? [mass, radius, polar] : [mass, radius];
    const rho = (M: number, R: number, P = R) =>
      oblateDensity.compute({ M: toKg(M), a: toM(R), b: toPolarM(P) });
    facts.density = derive(inputs, (M, R, P) => rho(M, R, P) / WATER_DENSITY, {
      unit: "ratio",
      source: mass.source,
      note: `mass / spheroid volume, over water's density (${WATER_DENSITY} kg/m³); spherical when no polar radius is available`,
      digits: 2,
    });
    if (drawn(facts.density) * WATER_DENSITY < AIR_DENSITY)
      facts.thinness = derive(inputs, (M, R, P) => AIR_DENSITY / rho(M, R, P), {
        unit: "ratio",
        source: mass.source,
        note: `sea-level air's density (${AIR_DENSITY} kg/m³) over the mean density`,
        digits: 2,
      });
    if (kind === "remnant")
      facts.teaspoon = derive(inputs, (M, R, P) => teaspoonKg(rho(M, R, P)), {
        unit: "kg",
        source: mass.source,
        note: "5 mL at the mean density",
        digits: 2,
      });
  }
  return facts;
}

export const RUNG_FACTS: Readonly<Record<RungId, RungFacts>> = recordFrom(RUNG_IDS, figuresOf);

export const CATALOGUE = { rungs: RUNG_FACTS } as const;

/** Every fact with its path ("rungs.betelgeuse.radius"), for tests and the ledger. */
export const catalogueFacts = () => factsOf(CATALOGUE);

/** A fact's central figure, or its span's geometric middle for drawing (never printed). */
export function drawn(fact: Fact) {
  return fact.value ?? Math.sqrt(fact.range[0] * fact.range[1]);
}

/** A rung's equatorial radius in metres, its spread, and its polar radius, for the ladder. */
export function radiusMetres(id: RungId) {
  const { radius, polar } = RUNG_FACTS[id];
  const toM = metres(radius);
  const [low, high] = radius.range ?? [drawn(radius), drawn(radius)];
  return {
    radius: toM(drawn(radius)),
    low: toM(low),
    high: toM(high),
    polar: polar ? metres(polar)(drawn(polar)) : toM(drawn(radius)),
  };
}

/**
 * The catalogue figures the cards' cautions and the technical notes quote, by placeholder,
 * in the unit their sentences name: "{vegaInclinationDeg}°".
 */
export const PROSE_FIGURES = {
  vegaInclinationDeg: NAMED_STARS.vega.inclination,
  achernarInclinationDeg: NAMED_STARS.achernar.inclination,
  stephensonKpc: NAMED_STARS["stephenson-2-18"].distance,
} satisfies Record<string, Fact>;
