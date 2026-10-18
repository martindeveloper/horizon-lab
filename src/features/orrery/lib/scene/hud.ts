/** The HUD readouts the engine publishes a few times a second: scale bar, realm, drift rate. */
import { convertDistance } from "@horizon/toolkit/science";

import { driftYearsPerSecond, viewById, viewForDistance, type Realm } from "../model/views";
import type { useOrrery } from "../store";
import { FOV, type Viewport } from "./kit";

const HUD_INTERVAL_S = 0.25;
const DRIFT_INTERVAL_S = 1;

function niceNumber(x: number) {
  if (!(x > 0)) return 1;
  const exp = Math.floor(Math.log10(x));
  const f = x / 10 ** exp;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * 10 ** exp;
}

export function createHud(store: typeof useOrrery, viewport: Viewport) {
  let clock = 0;
  let driftClock = 0;
  return {
    /** Writes the readouts on its interval, or at once when forced; only changes reach the store. */
    update(
      dt: number,
      force: boolean,
      view: {
        dist: number;
        realm: Realm;
        drift: boolean;
        driftYears: number;
        syncView?: boolean;
      },
    ) {
      clock += dt;
      driftClock += dt;
      if (!(clock > HUD_INTERVAL_S || force)) return;
      clock = 0;
      const { dist, realm } = view;
      const { width, height } = viewport;
      const s = store.getState();
      const worldPerPx = (2 * Math.tan((FOV * Math.PI) / 360) * dist) / Math.max(1, height);
      /* World units are au (solar) or ly (galaxy); the bar is a round number in the visitor's unit. */
      const perWorld = convertDistance(1, realm === "galaxy" ? "ly" : "au", s.distanceUnit);
      const nice = niceNumber(worldPerPx * perWorld * Math.min(150, width * 0.36));
      const px = Math.round(Math.max(44, Math.min(140, width * 0.4, nice / perWorld / worldPerPx)));
      const rate = view.drift ? driftYearsPerSecond(dist, realm) : 0;
      const nextView = view.syncView ? viewForDistance(dist, realm) : s.view;
      const nextDist = view.syncView !== false ? dist : viewById(s.view).dist;
      const distChanged = Math.abs(s.viewDist - nextDist) / Math.max(1, s.viewDist) > 0.04;
      let drifted = s.driftYears;
      if (view.driftYears === 0) {
        drifted = 0;
        driftClock = 0;
      } else if (driftClock >= DRIFT_INTERVAL_S) {
        drifted = Math.round(view.driftYears * 400) / 400;
        driftClock = 0;
      }
      if (
        distChanged ||
        s.view !== nextView ||
        s.viewRealm !== realm ||
        s.scaleValue !== nice ||
        s.scalePx !== px ||
        s.driftRate !== rate ||
        s.driftYears !== drifted
      )
        store.setState({
          view: nextView,
          viewDist: nextDist,
          viewRealm: realm,
          scalePx: px,
          scaleValue: nice,
          driftRate: rate,
          driftYears: drifted,
        });
    },
  };
}
