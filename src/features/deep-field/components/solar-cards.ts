/**
 * The solar system's cards as Deep Field shows it: where each thing is tonight, how long its
 * light takes to reach us, what it is, and how far its region reaches. Its history is the
 * Orrery's (each card leads there). Names and orbit words are the shared space copy.
 */
import {
  figure,
  formatAu,
  formatLightTime,
  print,
  type Card,
  type CardFact,
  type DistanceSettings,
  type Format,
  type Translate,
} from "@/lib/facts";
import { POPULATION_FIGURES } from "@/space/solar-system/cards";
import { moonRows, orbitFacts, radiusRow, solarNameKey } from "@/space/solar-system/format";
import { SOLAR_CATALOGUE } from "@/space/solar-system/model/catalogue";
import { namedElements, planetElements } from "@/space/solar-system/model/elements";
import { TODAY } from "@/space/solar-system/model/moment";
import { distanceFromEarth, positionOf } from "@/space/solar-system/model/position";
import type { SolarSelection } from "@/space/solar-system/model/selection";
import { TRACERS, tracerElements } from "@/space/solar-system/model/tracers";
import { namedById, type Elements } from "@horizon/toolkit/bodies";
import { lightTime } from "@horizon/toolkit/science";

const F = POPULATION_FIGURES;

/** "17–27 min": how long sunlight takes to cross out to each end of a region. */
function lightSpan(f: Format, [near, far]: readonly [number, number]) {
  const [a, b] = [lightTime(near), lightTime(far)];
  if (a.unit !== b.unit) return `${formatLightTime(f, near)} – ${formatLightTime(f, far)}`;
  const n = (time: typeof a) => f.number(time.value, { maximumFractionDigits: time.digits });
  return `${n(a)}–${n(b)} ${b.unit}`;
}

/** Tonight's distances: from Earth (the light we see) and from the Sun, each with its light-time. */
function whereRows(t: Translate, d: DistanceSettings, sel: SolarSelection, now: Date): CardFact[] {
  const rows: CardFact[] = [];
  const earth = distanceFromEarth(sel, TODAY, now);
  if (earth !== null)
    rows.push({ id: "fromEarth", label: t("facts.fromEarth"), value: formatAu(t, d, earth, true) });
  const at = sel.kind === "sun" ? null : positionOf(sel, TODAY, now);
  if (at)
    rows.push({
      id: "fromSun",
      label: t("facts.fromSun"),
      value: formatAu(t, d, Math.hypot(at[0], at[1], at[2]), true),
    });
  return rows;
}

/** The orbit's reach and period; its shape and tilt are the Orrery's to show. */
const orbitRows = (t: Translate, f: Format, d: DistanceSettings, el: Elements) =>
  orbitFacts(t, f, d, el).filter((row) => row.id === "nearFar" || row.id === "period");

/** The shared figures as bare values, each region followed by how long sunlight takes to cross it. */
function populationRows(
  t: Translate,
  f: Format,
  d: DistanceSettings,
  id: Extract<SolarSelection, { kind: "population" }>["id"],
): CardFact[] {
  switch (id) {
    case "asteroids":
      return [
        { id: "where", label: t("facts.where"), value: print(t, d, F.asteroids.where) },
        {
          id: "sunlight",
          label: t("facts.sunlight"),
          value: lightSpan(f, F.asteroids.where.fact.range),
        },
        {
          id: "mass",
          label: t("facts.mass"),
          value: t("cards.solar.asteroidsMass", { value: print(t, d, F.asteroids.mass) }),
        },
      ];
    case "kuiper":
      return [
        { id: "where", label: t("facts.where"), value: print(t, d, F.kuiper.region) },
        {
          id: "sunlight",
          label: t("facts.sunlight"),
          value: lightSpan(f, F.kuiper.region.fact.range),
        },
        {
          id: "mass",
          label: t("facts.mass"),
          value: t("cards.solar.kuiperMass", { value: print(t, d, F.kuiper.todayMass) }),
        },
        {
          id: "catalogued",
          label: t("facts.catalogued"),
          value: t("cards.solar.kuiperCatalogued", { value: print(t, d, F.kuiper.catalogued) }),
        },
      ];
    case "scattered":
      return [{ id: "where", label: t("facts.where"), value: t("cards.solar.scatteredWhere") }];
    case "oort":
      return [
        { id: "innerEdge", label: t("facts.innerEdge"), value: print(t, d, F.oort.innerEdge) },
        { id: "outerEdge", label: t("facts.outerEdge"), value: print(t, d, F.oort.outerEdge) },
      ];
    default:
      return [];
  }
}

function rowsOf(
  t: Translate,
  f: Format,
  d: DistanceSettings,
  sel: SolarSelection,
  now: Date,
): CardFact[] {
  switch (sel.kind) {
    case "sun":
      return [
        ...whereRows(t, d, sel, now),
        radiusRow(t, d, SOLAR_CATALOGUE.sun.sun.radius),
        {
          id: "age",
          label: t("facts.age"),
          value: t("cards.solar.age", { value: figure(t, d, SOLAR_CATALOGUE.sun.sun.age) }),
        },
      ];
    case "planet":
      return [
        ...whereRows(t, d, sel, now),
        radiusRow(t, d, SOLAR_CATALOGUE.planets[sel.id].radius),
        ...orbitFacts(t, f, d, planetElements(sel.id, 1, 0, now)).filter((r) => r.id === "period"),
      ];
    case "named":
      return [
        ...whereRows(t, d, sel, now),
        ...orbitRows(t, f, d, namedElements(namedById(sel.id), 1, 0, now)),
      ];
    case "moon":
      return [
        ...whereRows(t, d, sel, now),
        ...moonRows(t, f, d, sel.id).filter((row) => row.id !== "average"),
      ];
    case "tracer": {
      const tr = TRACERS[sel.index];
      return tr
        ? [...whereRows(t, d, sel, now), ...orbitRows(t, f, d, tracerElements(tr, 1, 0))]
        : [];
    }
    case "population":
      return populationRows(t, f, d, sel.id);
  }
}

/** The note under the figures: the body, belt or cloud by its own id; samples share one. */
function bodyKey(sel: SolarSelection) {
  switch (sel.kind) {
    case "sun":
      return "sun";
    case "planet":
    case "named":
      return sel.id;
    case "tracer":
      return "tracer";
    case "moon":
      return null;
    case "population":
      return sel.id === "disk" || sel.id === "ejected" ? null : sel.id;
  }
}

/** A solar system card tonight. Pure of React state. */
export function solarCard(
  t: Translate,
  f: Format,
  d: DistanceSettings,
  sel: SolarSelection,
  now: Date,
): Card {
  const body = bodyKey(sel);
  return {
    badge: t(
      sel.kind === "tracer"
        ? "badges.sample"
        : sel.kind === "population" && sel.id === "oort"
          ? "badges.inferred"
          : "badges.measured",
    ),
    title: t(solarNameKey(sel)),
    facts: rowsOf(t, f, d, sel, now),
    body: body ? t(`cards.solar.${body}`) : "",
    caution: "",
  };
}
