/** Names and orbit rows both simulations print, from the shared space copy. */
import {
  distanceFormat,
  figure,
  formatAu,
  type CardFact,
  type DistanceSettings,
  type Format,
  type Translate,
  type Value,
} from "@/lib/facts";
import { periodYears, type Elements } from "@horizon/toolkit/bodies";
import { convert, formatDistanceRange } from "@horizon/toolkit/science";

import type { SolarSelection } from "./model/selection";
import { TRACERS, binOf } from "./model/tracers";

function formatPeriod(t: Translate, f: Format, years: number) {
  const n = (v: number, digits: number) => f.number(v, { maximumFractionDigits: digits });
  if (years < 2) return t("facts.days", { value: n(convert(years, "yr", "d"), 0) });
  if (years < 1000) return t("facts.years", { value: n(years, years < 20 ? 1 : 0) });
  return t("facts.yearsAbout", { value: n(years, 0) });
}

/** Stretch, tilt, near–far and period rows for an orbit. */
export function orbitFacts(t: Translate, f: Format, d: DistanceSettings, el: Elements): CardFact[] {
  const n = (v: number, digits: number) => f.number(v, { maximumFractionDigits: digits });
  const e = Math.min(el.e, 0.995);
  const tilt = t("facts.tiltValue", { value: n(Math.abs(el.i) < 0.05 ? 0 : el.i, 1) });
  return [
    { id: "stretch", label: t("facts.stretch"), value: n(e, 3) },
    {
      id: "tilt",
      label: t("facts.tilt"),
      value: el.i > 90 ? `${tilt} · ${t("facts.retrograde")}` : tilt,
    },
    {
      id: "nearFar",
      label: t("facts.nearFar"),
      value: formatDistanceRange(el.a * (1 - e), el.a * (1 + e), distanceFormat(t, d)),
    },
    { id: "period", label: t("facts.period"), value: formatPeriod(t, f, periodYears(el.a)) },
  ];
}

/** The orbit's semi-major axis, then its shape, tilt, reach and period. */
export function orbitRows(t: Translate, f: Format, d: DistanceSettings, el: Elements): CardFact[] {
  return [
    { id: "average", label: t("facts.average"), value: formatAu(t, d, el.a, true) },
    ...orbitFacts(t, f, d, el),
  ];
}

/** A body's catalogued radius, in km. */
export function radiusRow(t: Translate, d: DistanceSettings, radius: Value): CardFact {
  return {
    id: "radius",
    label: t("facts.radius"),
    value: t("facts.km", { value: figure(t, d, radius) }),
  };
}

/**
 * The message key naming a selection: a body, a belt or cloud, or the population a sample is
 * in today.
 */
export function solarNameKey(sel: SolarSelection) {
  switch (sel.kind) {
    case "sun":
      return "names.sun";
    case "planet":
    case "named":
      return `names.${sel.id}`;
    case "population":
      return sel.id === "asteroids" ? "names.asteroids" : `layers.${sel.id}`;
    case "tracer": {
      const tr = TRACERS[sel.index];
      return tr ? `layers.${binOf(tr, 1)}` : "layers.disk";
    }
  }
}
