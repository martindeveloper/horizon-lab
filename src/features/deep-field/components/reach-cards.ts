/**
 * The cards for our reach: each probe where it is today (from Earth with its signal's
 * light-time, from the Sun, its speed and its dates), and the heliopause with the two places
 * it has been crossed.
 */
import {
  figure,
  formatAu,
  formatLightTime,
  type Card,
  type CardFact,
  type DistanceSettings,
  type Format,
  type Translate,
} from "@/lib/facts";
import {
  HELIOPAUSE_AU,
  firstLightDay,
  probeById,
  probeFromEarth,
  probeFromSun,
  probeSpeed,
  type ProbeId,
} from "@/space/solar-system/model/probes";
import { convert } from "@horizon/toolkit/science";

import { CATALOGUE } from "../lib/model/catalogue";

const C = CATALOGUE.probes;

/** A date as the card prints it; the probes' dates are UTC days. */
const day = (f: Format, date: Date | string) =>
  f.dateTime(new Date(date), { dateStyle: "long", timeZone: "UTC" });

function probeCard(t: Translate, f: Format, d: DistanceSettings, id: ProbeId, now: Date): Card {
  const probe = probeById(id);
  const speed = convert(probeSpeed(id, now), "au/yr", "km/s");
  const facts: CardFact[] = [
    {
      id: "fromEarth",
      label: t("facts.fromEarth"),
      value: formatAu(t, d, probeFromEarth(id, now), true),
    },
    { id: "fromSun", label: t("facts.fromSun"), value: formatAu(t, d, probeFromSun(id, now)) },
    {
      id: "speed",
      label: t("facts.speed"),
      value: t("cards.reach.speed", { value: f.number(speed, { maximumFractionDigits: 1 }) }),
    },
    { id: "launched", label: t("facts.launched"), value: day(f, probe.launched) },
  ];
  if (id === "voyager1" || id === "voyager2")
    facts.push({
      id: "heliopause",
      label: t("facts.leftHeliosphere"),
      value: t("cards.reach.crossed", {
        date: day(f, probe.crossed!.heliopause),
        distance: figure(t, d, C[id].heliopause),
      }),
    });
  const lightDay = firstLightDay(id);
  if (lightDay)
    facts.push({
      id: "lightDay",
      label: t("facts.lightDay"),
      value: t(lightDay <= now ? "cards.reach.since" : "cards.reach.from", {
        date: day(f, lightDay),
      }),
    });
  if (probe.lastSignal)
    facts.push({ id: "lastSignal", label: t("facts.lastSignal"), value: day(f, probe.lastSignal) });
  return {
    badge: t(probe.lastSignal ? "badges.inferred" : "badges.measured"),
    title: t(`names.${id}`),
    facts,
    body: t(`cards.reach.${id}`),
    caution: probe.lastSignal ? t("cards.reach.predicted") : "",
  };
}

function heliopauseCard(t: Translate, f: Format, d: DistanceSettings): Card {
  const crossed = (id: "voyager1" | "voyager2"): CardFact => ({
    id,
    label: t(`names.${id}`),
    value: t("cards.reach.crossed", {
      date: day(f, probeById(id).crossed!.heliopause),
      distance: figure(t, d, C[id].heliopause),
    }),
  });
  return {
    badge: t("badges.mixed"),
    title: t("names.heliopause"),
    facts: [
      crossed("voyager1"),
      crossed("voyager2"),
      {
        id: "shock",
        label: t("facts.shock"),
        value: t("cards.reach.shock", {
          v1: figure(t, d, C.voyager1.shock),
          v2: figure(t, d, C.voyager2.shock),
        }),
      },
      {
        id: "sunlight",
        label: t("facts.sunlight"),
        value: formatLightTime(f, HELIOPAUSE_AU),
      },
    ],
    body: t("cards.reach.heliopause"),
    caution: t("cards.reach.shape"),
  };
}

/** A probe or the heliopause, today. Pure of React state. */
export function reachCard(
  t: Translate,
  f: Format,
  d: DistanceSettings,
  id: ProbeId | "heliopause",
  now: Date,
): Card {
  return id === "heliopause" ? heliopauseCard(t, f, d) : probeCard(t, f, d, id, now);
}
