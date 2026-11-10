"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { ambientMusic } from "@/components/shell/ambient-music";
import { CrossingRow } from "@/components/simulations/crossing-row";
import { useDriftMusic } from "@/components/simulations/drift";
import { GuideCaption, type JourneyTiming } from "@/components/simulations/guide-caption";
import { GuideEquation } from "@/components/simulations/guide-card";
import { HandoffRow } from "@/components/simulations/handoff-link";
import { giantsManifest } from "@/features/giants/manifest";
import { spectroscopyManifest } from "@/features/spectroscopy/manifest";
import { sunManifest } from "@/features/sun/manifest";
import { slugRoutes } from "@/lib/simulation-paths";
import { simulationOn } from "@/lib/simulations";

import { PROSE_FIGURES } from "../lib/model/catalogue";
import { AFTERGLOW_EQUATIONS } from "../lib/model/equations";
import {
  JOURNEY_MUSIC,
  TOUR,
  TOUR_DWELL,
  beatAt,
  type Crossing,
  type TourStep,
} from "../lib/model/tour";
import { useAfterglow } from "../lib/store";

/** Where each crossing leads: the lab that shows what the step names, when its switch is on. */
const CROSSINGS: Readonly<Record<Exclude<Crossing, "orrery">, string | null>> = {
  sun: simulationOn(sunManifest) ? slugRoutes(sunManifest.routes).pathFor("surface") : null,
  spectroscopy: slugRoutes(spectroscopyManifest.routes).pathFor("stars"),
  giants: simulationOn(giantsManifest)
    ? slugRoutes(giantsManifest.routes).pathFor("sirius-b")
    : null,
};

function StepExtra({ step }: { step: TourStep }) {
  const t = useTranslations("afterglow");
  const equation = step.equation ? AFTERGLOW_EQUATIONS[step.equation] : undefined;
  const end = () => useAfterglow.getState().endGuide();
  const crossing = step.crossing;
  let link = null;
  if (crossing === "orrery") {
    link = (
      <HandoffRow
        to="orrery"
        view="inner"
        onClick={end}
        title={t("tour.crossings.orrery.title")}
        hint={t("tour.crossings.orrery.hint")}
      />
    );
  } else if (crossing && CROSSINGS[crossing]) {
    link = (
      <CrossingRow
        href={CROSSINGS[crossing]}
        onClick={end}
        title={t(`tour.crossings.${crossing}.title`)}
        hint={t(`tour.crossings.${crossing}.hint`)}
      />
    );
  }
  return (
    <>
      {equation ? <GuideEquation>{equation.toString()}</GuideEquation> : null}
      {link ? <div className="mt-2 -mb-1">{link}</div> : null}
    </>
  );
}

const extra = (step: TourStep) => <StepExtra step={step} />;
/**
 * The caption stands on the dock (`--dock-clear`, published at every width), so it publishes
 * its own height under another name: writing the one it stands on would lift it off the screen.
 */
const clearance = { property: "--caption-clear" };

/** The journey's track in the playlist; −1 when the playlist has none of that title. */
const journeyTrack = () =>
  ambientMusic.tracks.findIndex((track) => track.title === JOURNEY_MUSIC.track);

/** Seconds into the journey's track while the playlist plays it; null with the music off or on another track. */
function journeyClock() {
  if (ambientMusic.getState() !== "playing" || ambientMusic.getTrack() !== journeyTrack()) {
    return null;
  }
  return ambientMusic.position;
}

/** A hold the music gives is taken only if it is at least this long, and at most this much over the written one, seconds: past either the journey is off its music (a hand stepped it) and keeps its written timing. */
const HOLD_LEAST_S = 3;
const HOLD_SLACK_S = 6;
/** A ride the music gives is taken within this factor of the written one, either way. */
const RIDE_STRETCH = 1.5;

/**
 * The journey timed to its track: a landed step holds until the moment the journey must leave
 * to land the next on its beat, and the ride there takes what is left to that beat. Without
 * the music, or off it, both are the written ones (`TourStep.dwell`, `ride`), which add up to
 * the same beats.
 */
const TIMING: JourneyTiming = {
  holdLeft(index) {
    const at = journeyClock();
    const step = TOUR[index];
    const next = TOUR[index + 1];
    if (at === null || !step || !next) {
      return null;
    }
    const left = beatAt(next.beat) - next.ride - at;
    const written = step.dwell ?? TOUR_DWELL;
    return left >= HOLD_LEAST_S && left <= written + HOLD_SLACK_S ? left : null;
  },
  ride(next) {
    const step = TOUR[next];
    if (!step) {
      return undefined;
    }
    const at = journeyClock();
    const toBeat = at === null ? null : beatAt(step.beat) - at;
    const fits =
      toBeat !== null && toBeat >= step.ride / RIDE_STRETCH && toBeat <= step.ride * RIDE_STRETCH;
    return fits ? toBeat : step.ride;
  },
};

/**
 * The journey's music: the playlist holds on its track at the drift's level while the guide is
 * open, and a track already playing starts again from its first bar, as a staged piece does.
 * It never starts music the visitor has off.
 */
function useJourneyMusic() {
  useEffect(() => {
    if (ambientMusic.getState() === "playing" && ambientMusic.getTrack() === journeyTrack()) {
      ambientMusic.restart();
    }
  }, []);
  useDriftMusic(JOURNEY_MUSIC, true);
}

/** The journey's caption: where and when we stand, what to notice, a formula, a way across. */
export function AfterglowGuide() {
  const index = useAfterglow((s) => s.guideStep);
  const playing = useAfterglow((s) => s.guidePlaying);
  const landed = useAfterglow((s) => s.guideLanded);
  useJourneyMusic();
  return (
    <GuideCaption
      namespace="afterglow"
      getState={useAfterglow.getState}
      tour={TOUR}
      dwell={TOUR_DWELL}
      index={index}
      playing={playing}
      landed={landed}
      className="bottom-(--dock-clear,6rem) pb-2"
      clearance={clearance}
      extra={extra}
      figures={PROSE_FIGURES}
      timing={TIMING}
    />
  );
}
