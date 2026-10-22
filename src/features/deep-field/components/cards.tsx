import {
  buildCard,
  formatAu,
  printAll,
  staticCard,
  v,
  type Card,
  type DistanceSettings,
  type Format,
  type Of,
  type Translate,
} from "@/lib/facts";
import { ATLAS_CARD_SOURCES, ATLAS_SOURCES, isAtlasId } from "@/space/cosmos/model/atlas";
import {
  NEIGHBOURS,
  closestApproach,
  neighbour,
  neighbourDistanceLy,
} from "@/space/galaxy/model/neighbours";
import { LIGHT_YEAR_AU } from "@horizon/toolkit/science";

import { CATALOGUE } from "../lib/model/catalogue";
import type { Selection } from "../lib/store";
import { COSMOS_CARDS, GALAXY_CARDS, STAR_CARDS } from "./card-specs";
import { reachCard } from "./reach-cards";
import { solarCard } from "./solar-cards";

export const NEIGHBOUR_IDS = NEIGHBOURS.map((n) => n.id);

/** A neighbour: its distance today and closest approach from its track, the rest from its definition. */
function starCard(t: Translate, d: DistanceSettings, sel: Of<Selection, "star">): Card {
  const star = neighbour(sel.id);
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
        value: t(
          closestApproach(star).yearsAgo > 0 ? "facts.closestPast" : "facts.closestFuture",
          printAll(t, d, { distance: v(c.approach), years: v(c.approachWhen) }),
        ),
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
    case "cosmos": {
      const key = `cards.cosmos.${sel.id}`;
      const spec = COSMOS_CARDS[sel.id];
      // Publication badges follow the pinned source manifest when a preprint is
      // accepted or published. The paper's accompanying prose still needs review.
      const publication = isAtlasId(sel.id)
        ? ATLAS_SOURCES[ATLAS_CARD_SOURCES[sel.id][0]!].publication
        : "published";
      const badge =
        spec.badge !== "reconstruction" || publication === "published"
          ? spec.badge
          : publication === "accepted"
            ? "acceptedReconstruction"
            : "preprintReconstruction";
      const translate: Translate = (message, values) =>
        t(isAtlasId(sel.id) && message === `${key}.title` ? `names.${sel.id}` : message, values);
      return staticCard(translate, d, key, { ...spec, badge });
    }
    case "reach":
      return reachCard(t, f, d, sel.id, now);
    default:
      return solarCard(t, f, d, sel, now);
  }
}
