"use client";

import { CrossingRow } from "@/components/simulations/crossing-row";
import { SelectionSheet } from "@/components/simulations/selection-sheet";

import { RUNG_FACTS, drawn } from "../lib/model/catalogue";
import { RUNG_IDS } from "../lib/model/rungs";
import { useGiants } from "../lib/store";
import { CardSources } from "./card-sources";
import { UP_CLOSE } from "./card-specs";
import { Compare } from "./compare";
import { rungCard, useDistance, useGiantsT } from "./format";
import { HrDiagram } from "./hr-diagram";
import { LightLap } from "./light-lap";

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
          <HrDiagram id={id} />
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
