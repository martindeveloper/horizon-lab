import { useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";

import {
  GuideBody,
  GuideCard,
  GuideEquation,
  GuideTitle,
} from "@/components/simulations/guide-card";
import { useGuideKeys } from "@/components/simulations/use-guide-keys";
import { useBlackHole } from "@/features/black-hole/lib/store";
import { tourFor, type TourBeat } from "@/features/black-hole/lib/tours";

import { GuideSketch } from "./guide-sketch";

/** The guide's keys read the beat as a step: Space and the right arrow move on, left goes back. */
const guideState = () => {
  const s = useBlackHole.getState();
  return {
    guideOpen: s.guideOpen,
    guideStep: s.guideBeat,
    goGuide: (step: number) => (step > s.guideBeat ? s.advanceGuide() : s.previousGuide()),
  };
};
const guideKeys = {
  onSpace: (api: ReturnType<typeof guideState>) => api.goGuide(api.guideStep + 1),
};

/**
 * The tour, on the shared guide card: each beat's words show as the camera flies to its shot,
 * and the hairline sketches join once it lands.
 */
export function GuideOverlay() {
  const t = useTranslations("blackHole");
  const presetId = useBlackHole((s) => s.presetId);
  const beatIndex = useBlackHole((s) => s.guideBeat);
  const arrived = useBlackHole((s) => s.guideArrived);
  const reduce = useReducedMotion();
  const beats = useMemo(() => {
    const key = t.has(`tours.${presetId}`) ? presetId : "custom";
    return tourFor(presetId).map((pose, index): TourBeat => ({
      ...pose,
      kicker: t(`tours.${key}.${index}.kicker`),
      title: t(`tours.${key}.${index}.title`),
      body: t(`tours.${key}.${index}.body`),
    }));
  }, [presetId, t]);
  const beat = beats[beatIndex] ?? beats[0]!;
  const last = beatIndex >= beats.length - 1;

  useGuideKeys(guideState, guideKeys);

  // The header and its Guide button remount when the tour ends; hand focus back to it.
  useEffect(
    () => () => {
      const active = document.activeElement;
      if (active && active !== document.body) return;
      document.querySelector<HTMLElement>('[data-return="guide"]')?.focus({ preventScroll: true });
    },
    [],
  );

  // The engine lands each shot; this lands it too when no frame runs (a hidden tab, reduced motion).
  useEffect(() => {
    if (arrived) return;
    const ms = reduce ? 60 : Math.round(beat.duration * 1000);
    const id = window.setTimeout(() => useBlackHole.getState().setGuideArrived(true), ms);
    return () => window.clearTimeout(id);
  }, [beat, arrived, reduce]);

  const api = useBlackHole.getState;
  return (
    <>
      <GuideSketch />
      <GuideCard
        label={t("guide")}
        kicker={t("guideProgress", {
          step: beatIndex + 1,
          total: beats.length,
          kicker: beat.kicker,
        })}
        stepKey={`${presetId}-${beatIndex}`}
        focusNext
        progress={{ step: beatIndex, total: beats.length }}
        controls={{
          previous: {
            label: t("previousBeat"),
            disabled: beatIndex === 0,
            onClick: () => api().previousGuide(),
          },
          next: {
            label: last ? t("finish") : t("next"),
            last,
            onClick: () => api().advanceGuide(),
          },
          exit: { label: t("exit"), onClick: () => api().endGuide() },
        }}
      >
        <GuideTitle>{beat.title}</GuideTitle>
        <GuideBody>{beat.body}</GuideBody>
        {beat.eq ? <GuideEquation>{beat.eq}</GuideEquation> : null}
      </GuideCard>
    </>
  );
}
