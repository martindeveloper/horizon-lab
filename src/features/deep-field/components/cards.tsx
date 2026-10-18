import {
  buildCard,
  figure,
  formatAu,
  staticCard,
  type Card,
  type DistanceSettings,
  type Format,
  type Translate,
} from "@/lib/facts";
import { LIGHT_YEAR_AU } from "@horizon/toolkit/science";

import { CATALOGUE } from "../lib/model/catalogue";
import { NEIGHBOURS, closestApproach, neighbourDistanceLy } from "../lib/model/neighbours";
import type { Selection } from "../lib/store";
import { COSMOS_CARDS, GALAXY_CARDS, STAR_CARDS } from "./card-specs";
import { solarCard } from "./solar-cards";

type Of<K extends Selection["kind"]> = Extract<Selection, { kind: K }>;

export const NEIGHBOUR_IDS = NEIGHBOURS.map((n) => n.id);

/** A neighbour: its distance today and closest approach from its track, the rest from its definition. */
function starCard(t: Translate, d: DistanceSettings, sel: Of<"star">): Card {
  const star = NEIGHBOURS.find((s) => s.id === sel.id)!;
  const c = CATALOGUE.stars[sel.id];
  const built = buildCard(t, d, STAR_CARDS[sel.id]);
  return {
    badge: t("badges.measured"),
    title: t(`names.${sel.id}`),
    facts: [
      {
        id: "distance",
        label: t("facts.today"),
        value: formatAu(t, d, neighbourDistanceLy(star, 0) * LIGHT_YEAR_AU),
      },
      ...built.facts,
      {
        id: "closest",
        label: t("facts.closest"),
        value: t(closestApproach(star).yearsAgo > 0 ? "facts.closestPast" : "facts.closestFuture", {
          distance: figure(t, d, c.approach),
          years: figure(t, d, c.approachWhen),
        }),
      },
    ],
    body: t(`cards.stars.${sel.id}.body`, built.body),
    caution: t("cards.stars.caution"),
  };
}

/** The card for a selection, today. Pure of React state. */
export function cardFor(
  t: Translate,
  f: Format,
  sel: Selection,
  d: DistanceSettings,
  now: Date,
): Card {
  switch (sel.kind) {
    case "star":
      return starCard(t, d, sel);
    case "galaxy":
      return staticCard(t, d, `cards.galaxy.${sel.id}`, GALAXY_CARDS[sel.id]);
    case "cosmos":
      return staticCard(t, d, `cards.cosmos.${sel.id}`, COSMOS_CARDS[sel.id]);
    default:
      return solarCard(t, f, d, sel, now);
  }
}
