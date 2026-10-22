/**
 * The observatories' cards: Hubble and Chandra by their catalogued orbits (heights above
 * Earth, period, tilt to the equator), Webb by where it is today and the L2 point it circles.
 */
import {
  figure,
  type Card,
  type CardFact,
  type DistanceSettings,
  type Format,
  type Translate,
} from "@/lib/facts";
import {
  elementEpoch,
  isSatellite,
  observatoryById,
  webbFromEarthKm,
  type ObservatoryId,
  type SatelliteId,
} from "@/space/solar-system/model/observatories";
import { OBSERVATORY_CATALOGUE } from "@/space/solar-system/model/observatories-catalogue";

const C = OBSERVATORY_CATALOGUE;

/** A date as the card prints it: UTC days. */
const day = (f: Format, date: Date | string) =>
  f.dateTime(new Date(date), { dateStyle: "long", timeZone: "UTC" });

/** Heights above Earth, the time once round and the tilt to the equator. */
function orbitFacts(t: Translate, d: DistanceSettings, id: SatelliteId): CardFact[] {
  const { perigee, apogee, period, tilt } = C[id];
  return [
    {
      id: "height",
      label: t("facts.height"),
      value: t("facts.kmSpan", { near: figure(t, d, perigee), far: figure(t, d, apogee) }),
    },
    {
      id: "period",
      label: t("facts.period"),
      value: t(period.unit === "min" ? "facts.minutes" : "facts.hours", {
        value: figure(t, d, period),
      }),
    },
    {
      id: "tilt",
      label: t("facts.tilt"),
      value: t("facts.tiltEquator", { value: figure(t, d, tilt) }),
    },
  ];
}

/** Webb from Earth today (in km, as the Moon's distance), the L2 point beyond Earth, and its time round it. */
function webbFacts(t: Translate, f: Format, d: DistanceSettings, now: Date): CardFact[] {
  return [
    {
      id: "fromEarth",
      label: t("facts.fromEarth"),
      value: t("facts.km", {
        value: f.number(webbFromEarthKm(now), { maximumSignificantDigits: 4 }),
      }),
    },
    { id: "l2", label: t("facts.l2"), value: t("facts.km", { value: figure(t, d, C.webb.l2) }) },
    {
      id: "halo",
      label: t("facts.halo"),
      value: t("facts.days", { value: figure(t, d, C.webb.halo) }),
    },
  ];
}

/** An observatory today. Pure of React state. */
export function observatoryCard(
  t: Translate,
  f: Format,
  d: DistanceSettings,
  id: ObservatoryId,
  now: Date,
): Card {
  const launched: CardFact = {
    id: "launched",
    label: t("facts.launched"),
    value: day(f, observatoryById(id).launched),
  };
  const satellite = isSatellite(id) ? id : null;
  /* Webb's place is tracked, then predicted, and its L2 derived: measured and model. */
  return {
    badge: t(satellite ? "badges.measured" : "badges.mixed"),
    title: t(`names.${id}`),
    facts: [...(satellite ? orbitFacts(t, d, satellite) : webbFacts(t, f, d, now)), launched],
    body: t(`cards.observatories.${id}`),
    caution: satellite
      ? t("cards.observatories.elements", { date: day(f, elementEpoch(satellite)) })
      : t("cards.observatories.halo"),
  };
}
