/**
 * The cards for what the ship looks at: how far a body is from the ship and from the Sun,
 * its size, its orbit; for the far places, how long their light has been on its way (the map
 * draws them where they are now). Names and orbit words are the shared space copy.
 */
import type { useTranslations } from "next-intl";

import type { Card, CardFact, DistanceSettings, Format } from "@/lib/facts";
import type { WorldSelection } from "@/space/galaxy/show";
import { moonRows, orbitFacts, radiusRow, solarNameKey } from "@/space/solar-system/format";
import { SOLAR_CATALOGUE } from "@/space/solar-system/model/catalogue";
import { namedElements, planetElements } from "@/space/solar-system/model/elements";
import { isSolarSelection, type SolarSelection } from "@/space/solar-system/model/selection";
import { namedById } from "@horizon/toolkit/bodies";
import { vec3d } from "@horizon/toolkit/scene";
import { JULIAN_YEAR_SECONDS } from "@horizon/toolkit/science";

import { anchorAt, anchorNameKey, anchorOfSelection, type AnchorId } from "../lib/model/anchors";
import { lookbackYears } from "../lib/model/comoving";
import { formatDuration, formatRange } from "./format";

type T = ReturnType<typeof useTranslations<"voyage">>;

const at = vec3d();

/** The message key naming a selection beyond the solar system. */
function farNameKey(t: T, sel: Exclude<WorldSelection, SolarSelection>) {
  if (sel.kind === "star" || sel.kind === "reach") return `names.${sel.id}`;
  if (sel.kind === "galaxy") return sel.id === "sun" ? "names.galaxySun" : `names.${sel.id}`;
  const anchor = anchorOfSelection(sel);
  if (anchor && t.has(anchorNameKey(anchor))) return anchorNameKey(anchor);
  return `names.${sel.id}`;
}

/** How far an anchor is from the ship and (but for the Sun) from the Sun; the range, km. */
function whereRows(
  t: T,
  f: Format,
  d: DistanceSettings,
  id: AnchorId,
  now: Date,
  ship: ArrayLike<number>,
) {
  anchorAt(id, now, at);
  const range = Math.hypot(at[0] - ship[0]!, at[1] - ship[1]!, at[2] - ship[2]!);
  const rows: CardFact[] = [
    { id: "fromShip", label: t("facts.fromShip"), value: formatRange(t, f, d, range) },
  ];
  if (id !== "sun")
    rows.push({
      id: "fromSun",
      label: t("facts.fromSun"),
      value: formatRange(t, f, d, Math.hypot(at[0], at[1], at[2])),
    });
  return { rows, range };
}

function rowsOf(
  t: T,
  f: Format,
  d: DistanceSettings,
  sel: SolarSelection,
  now: Date,
  ship: ArrayLike<number>,
): CardFact[] {
  switch (sel.kind) {
    case "sun":
      return [
        ...whereRows(t, f, d, "sun", now, ship).rows,
        radiusRow(t, d, SOLAR_CATALOGUE.sun.sun.radius),
      ];
    case "planet":
      return [
        ...whereRows(t, f, d, sel.id, now, ship).rows,
        radiusRow(t, d, SOLAR_CATALOGUE.planets[sel.id].radius),
        ...orbitFacts(t, f, d, planetElements(sel.id, 1, 0, now)).filter((r) => r.id === "period"),
      ];
    case "named":
      return [
        ...whereRows(t, f, d, sel.id, now, ship).rows,
        ...orbitFacts(t, f, d, namedElements(namedById(sel.id), 1, 0, now)).filter(
          (r) => r.id === "nearFar" || r.id === "period",
        ),
      ];
    case "moon":
      return [...whereRows(t, f, d, sel.id, now, ship).rows, ...moonRows(t, f, d, sel.id)];
    default:
      return [];
  }
}

/** A far selection's card: its name, and how far it is from the ship when it can be flown to. */
function farCard(
  t: T,
  f: Format,
  sel: Exclude<WorldSelection, SolarSelection>,
  d: DistanceSettings,
  now: Date,
  ship: ArrayLike<number>,
): Card {
  const anchor = anchorOfSelection(sel);
  const facts: CardFact[] = [];
  if (anchor) {
    const { rows, range } = whereRows(t, f, d, anchor, now, ship);
    facts.push(...rows, {
      id: "lightAge",
      label: t("facts.lightAge"),
      value: formatDuration(t, f, lookbackYears(range) * JULIAN_YEAR_SECONDS),
    });
  }
  const note = `cards.far.${sel.id}`;
  return {
    badge: t("badges.measured"),
    title: t(farNameKey(t, sel)),
    facts,
    body: t.has(note) ? t(note) : "",
    caution: "",
  };
}

/** The card for a selection, from where the ship is. Pure of React state. */
export function cardFor(
  t: T,
  f: Format,
  sel: WorldSelection,
  d: DistanceSettings,
  now: Date,
  ship: ArrayLike<number>,
): Card {
  if (!isSolarSelection(sel)) return farCard(t, f, sel, d, now, ship);
  const body = anchorOfSelection(sel);
  const note = body ? `cards.bodies.${body}` : null;
  return {
    badge: t("badges.measured"),
    title: t(solarNameKey(sel)),
    facts: rowsOf(t, f, d, sel, now, ship),
    body: note && t.has(note) ? t(note) : "",
    caution: "",
  };
}
