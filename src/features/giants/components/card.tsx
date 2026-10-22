"use client";

import { CrossingRow } from "@/components/simulations/crossing-row";
import { HrDiagram } from "@/components/simulations/hr-diagram";
import { SelectionSheet } from "@/components/simulations/selection-sheet";
import { HR_POINTS, hrPointsOf, isStarId } from "@/space/hr-diagram";

import { RUNG_FACTS, drawn } from "../lib/model/catalogue";
import { RUNG_IDS } from "../lib/model/rungs";
import { useGiants } from "../lib/store";
import { CardSources } from "./card-sources";
import { UP_CLOSE } from "./card-specs";
import { Compare } from "./compare";
import { rungCard, useDistance, useGiantsT } from "./format";
import { LightLap } from "./light-lap";

/** The ladder's stars on the HR diagram, from the shared catalogue: every rung that is one. */
const LADDER_STARS = hrPointsOf(RUNG_IDS.flatMap((id) => (isStarId(id) ? [id] : [])));
/** A dot on the diagram flies to its rung. */
const rungOf = (star: string) => RUNG_IDS.find((id) => id === star);

/**
 * The card of the body in focus, following it as the camera climbs: its figures, how it
 * measures against a yardstick, where it sits among the stars, provenance, a geometric
 * light-speed size comparison and, for a black hole, the way to see it up close in the Black
 * holes lab. It takes focus only when the visitor opens it.
 */
export function RungCard() {
  const { t, has } = useGiantsT();
  const distance = useDistance();
  const id = useGiants((s) => RUNG_IDS[s.focus]!);
  const sheet = useGiants((s) => s.sheet);
  const guideOpen = useGiants((s) => s.guideOpen);
  const card = rungCard(t, distance, id, has);
  const lap = RUNG_FACTS[id].lap;
  const upClose = UP_CLOSE[id];
  return (
    <SelectionSheet
      card={card}
      closeLabel={t("card.close")}
      onClose={() => useGiants.getState().setCard(false)}
      folded={guideOpen}
      takeFocus={sheet}
      details={
        <>
          <Compare id={id} />
          {isStarId(id) && HR_POINTS[id] ? (
            <HrDiagram
              namespace="giants"
              points={LADDER_STARS}
              nameOf={(star) => t(`names.${star}`)}
              focus={id}
              onPick={(star) => {
                const rung = rungOf(star);
                if (rung) useGiants.getState().goTo(rung);
              }}
            />
          ) : null}
          <CardSources key={id} id={id} t={t} />
        </>
      }
      footer={
        <>
          <LightLap seconds={drawn(lap)} label={t("card.light")} />
          {upClose ? (
            <CrossingRow href={upClose} title={t("card.upClose")} hint={t("card.upCloseHint")} />
          ) : null}
        </>
      }
    />
  );
}
