import { bodyDestinations } from "@/lib/body-destinations";
/**
 * What each rung's card shows, as data: rows (a fact label, the message that words it and the
 * catalogue figures that fill its placeholders). Every rung shares one layout; which rows it
 * has follows from the figures it has. cards.tsx prints them with the shared printer.
 */
import {
  factRef,
  factSources,
  figureRow,
  row,
  v,
  type CardSpec,
  type Fact,
  type Row,
} from "@/lib/facts";
import { recordFrom } from "@horizon/toolkit/records";

import { RUNG_ENGINES, RUNG_FACTS, inUnit } from "../lib/model/catalogue";
import { RUNG_IDS, rungById, type RungId } from "../lib/model/rungs";

/** A card's way to the lab that shows its body up close: the lab's address, and its hint's words. */
export type UpClose = { href: string; hint: "upCloseHint" | "upCloseSunHint" | "upCloseOtherHint" };

/** Destination-specific wording stays here; a newly exposed lab gets a general hint. */
const DESTINATION_HINTS: Readonly<Record<string, UpClose["hint"]>> = {
  "black-hole": "upCloseHint",
  sun: "upCloseSunHint",
};

/** The destination lab declares its body; this feature owns the wording of its link. */
export const UP_CLOSE: Partial<Record<RungId, UpClose>> = Object.fromEntries(
  RUNG_IDS.flatMap((id) => {
    const body = rungById(id).body;
    const destination = bodyDestinations(body)[0];
    return destination
      ? [
          [
            id,
            {
              href: destination.href,
              hint: DESTINATION_HINTS[destination.simulationId] ?? "upCloseOtherHint",
            } satisfies UpClose,
          ],
        ]
      : [];
  }),
);

/** Light's lap in the unit that reads best: seconds up to two minutes, then minutes, hours, days. */
function lapRow(lap: Fact): Row {
  const seconds = lap.range?.[1] ?? lap.value!;
  const unit = seconds < 120 ? "s" : seconds < 7_200 ? "min" : seconds < 172_800 ? "h" : "d";
  return row("lap", `rows.lap.${unit}`, { value: factRef({ ...lap, show: unit }) });
}

/** A turn in the unit that reads best: milliseconds under a second, then hours, days, years. */
function periodRow(period: Fact, upTo: boolean): Row {
  const seconds = inUnit(period, "s")(period.range?.[1] ?? period.value!);
  const unit = seconds < 1 ? "ms" : seconds < 172_800 ? "h" : seconds < 63_115_200 ? "d" : "yr";
  const text = `rows.${upTo ? "periodUpTo" : "period"}.${unit}`;
  /* A limit reads as one figure ("up to 36 years"); its spread stays in the sources. */
  const value =
    upTo && period.value !== undefined
      ? v({ ...period, value: period.value, show: unit })
      : factRef({ ...period, show: unit });
  return row("rotation", text, { value });
}

/**
 * The bodies the others are measured against (the Sun for stars, Earth for masses): their own
 * figures would read "1 × itself", so their cards give them in SI instead.
 */
const YARDSTICKS: ReadonlySet<RungId> = new Set(["sun", "earth"]);

function specOf(id: RungId): CardSpec {
  const facts = RUNG_FACTS[id];
  const kind = rungById(id).kind;
  const { radius, mass, teff, luminosity, distance, lap, density, thinness, teaspoon, bulge } =
    facts;
  const { gravity, gravityEarths, gravityWeaker, rotation, rotationLimit } = facts;
  const absolute = YARDSTICKS.has(id);
  const small = absolute || radius.unit === "km" || radius.show === "km";
  const rows: Row[] = [
    row(kind === "horizon" ? "horizon" : "radius", small ? "rows.km" : "rows.suns", {
      value: factRef(small && radius.unit !== "km" ? { ...radius, show: "km" } : radius),
    }),
  ];
  if (bulge) rows.push(row("bulge", "rows.bulge", { value: factRef(bulge) }));
  if (mass)
    rows.push(
      absolute
        ? row("mass", "rows.kg", { value: factRef({ ...mass, show: "kg" }) })
        : row("mass", mass.unit === "Mearth" ? "rows.earths" : "rows.massSuns", {
            value: factRef(mass),
          }),
    );
  /* Gravity is compared with Earth's, so Earth's own reads alone. */
  const against = id === "earth" ? undefined : (gravityEarths ?? gravityWeaker);
  if (gravity)
    rows.push(
      against
        ? row("gravity", gravityEarths ? "rows.gravity" : "rows.gravityWeaker", {
            value: factRef(gravity),
            earths: factRef(against),
          })
        : row("gravity", "rows.gravityAlone", { value: factRef(gravity) }),
    );
  if (rotation) rows.push(periodRow(rotation, false));
  else if (rotationLimit) rows.push(periodRow(rotationLimit, true));
  if (teff) rows.push(row("teff", "rows.kelvin", { value: factRef(teff) }));
  if (luminosity)
    rows.push(
      absolute
        ? row("luminosity", "rows.watts", { value: factRef({ ...luminosity, show: "W" }) })
        : row("luminosity", "rows.luminosity", { value: factRef(luminosity) }),
    );
  rows.push(lapRow(lap));
  if (thinness) rows.push(row("density", "rows.thinner", { value: factRef(thinness) }));
  else if (density) rows.push(row("density", "rows.denser", { value: factRef(density) }));
  if (teaspoon) rows.push(row("teaspoon", "rows.kg", { value: factRef(teaspoon) }));
  if (distance) rows.push(figureRow("distance", factRef(distance)));
  return { rows };
}

export const RUNG_CARDS: Readonly<Record<RungId, CardSpec>> = recordFrom(RUNG_IDS, specOf);

/** Provenance for exactly the quantities visible on a card, including all derived inputs. */
export function cardSources(id: RungId) {
  const engine = RUNG_ENGINES[id];
  const figures = RUNG_CARDS[id].rows.flatMap((row) => {
    const refs = row.figure ? [row.figure] : Object.values(row.args ?? {});
    const first = refs[0];
    if (!first) return [];
    return [
      {
        id: row.id,
        status: first.fact.status,
        sources: [...new Set(refs.flatMap(({ fact }) => factSources(fact)))],
      },
    ];
  });
  return [...figures, { id: "engine", status: engine.status, sources: [...engine.sources] }];
}
