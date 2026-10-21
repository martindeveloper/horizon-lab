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
import {
  hasSurface,
  isSolarSelection,
  type SolarSelection,
} from "@/space/solar-system/model/selection";
import { namedById, type BodyId } from "@horizon/toolkit/bodies";
import { vec3d } from "@horizon/toolkit/scene";

import { anchorAt, anchorNameKey, type AnchorId } from "../lib/model/anchors";
import { bodyPositionKm } from "../lib/model/bodies";
import { lookbackYears } from "../lib/model/comoving";
import { formatDuration, formatRange } from "./format";

type T = ReturnType<typeof useTranslations<"voyage">>;

const at = vec3d();
const YEAR_S = 365.25 * 86_400;

/** The anchor a selection is, if the ship can fly to it. */
export function bodyOfSelection(sel: WorldSelection): AnchorId | null {
  if (isSolarSelection(sel)) return hasSurface(sel) ? (sel.kind === "sun" ? "sun" : sel.id) : null;
  if (sel.kind === "star") return sel.id === "alphaCen" ? "alphaCen" : null;
  if (sel.kind === "galaxy") return sel.id === "sun" ? "sun" : "galacticCentre";
  if (sel.kind === "cosmos") return sel.id === "andromeda" ? "andromeda" : null;
  return null;
}

/** The message key naming a selection beyond the solar system. */
function farNameKey(t: T, sel: Exclude<WorldSelection, SolarSelection>) {
  if (sel.kind === "star" || sel.kind === "reach") return `names.${sel.id}`;
  if (sel.kind === "galaxy") return sel.id === "sun" ? "names.galaxySun" : `names.${sel.id}`;
  const anchor = bodyOfSelection(sel);
  if (anchor && t.has(anchorNameKey(anchor))) return anchorNameKey(anchor);
  return `names.${sel.id}`;
}

/** From the ship and from the Sun, each with its light-time. */
function whereRows(
  t: T,
  f: Format,
  d: DistanceSettings,
  id: BodyId,
  now: Date,
  ship: ArrayLike<number>,
): CardFact[] {
  bodyPositionKm(id, now, at);
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
  return rows;
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
        ...whereRows(t, f, d, "sun", now, ship),
        radiusRow(t, d, SOLAR_CATALOGUE.sun.sun.radius),
      ];
    case "planet":
      return [
        ...whereRows(t, f, d, sel.id, now, ship),
        radiusRow(t, d, SOLAR_CATALOGUE.planets[sel.id].radius),
        ...orbitFacts(t, f, d, planetElements(sel.id, 1, 0, now)).filter((r) => r.id === "period"),
      ];
    case "named":
      return [
        ...whereRows(t, f, d, sel.id, now, ship),
        ...orbitFacts(t, f, d, namedElements(namedById(sel.id), 1, 0, now)).filter(
          (r) => r.id === "nearFar" || r.id === "period",
        ),
      ];
    case "moon":
      return [...whereRows(t, f, d, sel.id, now, ship), ...moonRows(t, f, d, sel.id)];
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
  const anchor = bodyOfSelection(sel);
  const facts: CardFact[] = [];
  if (anchor) {
    anchorAt(anchor, now, at);
    const range = Math.hypot(at[0] - ship[0]!, at[1] - ship[1]!, at[2] - ship[2]!);
    facts.push({ id: "fromShip", label: t("facts.fromShip"), value: formatRange(t, f, d, range) });
    facts.push({
      id: "fromSun",
      label: t("facts.fromSun"),
      value: formatRange(t, f, d, Math.hypot(at[0], at[1], at[2])),
    });
    facts.push({
      id: "lightAge",
      label: t("facts.lightAge"),
      value: formatDuration(t, f, lookbackYears(range) * YEAR_S),
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
  const body = bodyOfSelection(sel);
  const note = body ? `cards.bodies.${body}` : null;
  return {
    badge: t("badges.measured"),
    title: t(solarNameKey(sel)),
    facts: rowsOf(t, f, d, sel, now, ship),
    body: note && t.has(note) ? t(note) : "",
    caution: "",
  };
}
