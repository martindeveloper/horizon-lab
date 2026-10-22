import { useReducedMotion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";

import { tourControls } from "@/components/simulations/guide-caption";
import {
  GuideBody,
  GuideCard,
  GuideEquation,
  GuideTitle,
} from "@/components/simulations/guide-card";
import { useGuideKeys } from "@/components/simulations/use-guide-keys";
import { figureArgs } from "@/features/black-hole/lib/figures";
import { useBlackHole } from "@/features/black-hole/lib/store";
import { tourFor, type TourStep } from "@/features/black-hole/lib/tours";

import { GuideSketch } from "./guide-sketch";

/** Space and the right arrow move on, left goes back. */
const guideKeys = {
  onSpace: (api: ReturnType<typeof useBlackHole.getState>) => api.goGuide(api.guideStep + 1),
};

/**
 * The tour, on the shared guide card: each step's words show as the camera flies to its shot,
 * and the hairline sketches join once it lands.
 */
export function GuideOverlay() {
  const t = useTranslations("blackHole");
  const tGuide = useTranslations("guide");
  const presetId = useBlackHole((s) => s.presetId);
  const index = useBlackHole((s) => s.guideStep);
  const arrived = useBlackHole((s) => s.guideArrived);
  const reduce = useReducedMotion();
  const locale = useLocale();
  const steps = useMemo(() => {
    const key = t.has(`tours.${presetId}`) ? presetId : "custom";
    const figures = figureArgs(locale);
    return tourFor(presetId).map((pose, i): TourStep => ({
      ...pose,
      kicker: t(`tours.${key}.${i}.kicker`, figures),
      title: t(`tours.${key}.${i}.title`, figures),
      body: t(`tours.${key}.${i}.body`, figures),
    }));
  }, [presetId, t, locale]);
  const step = steps[index] ?? steps[0]!;

  useGuideKeys(useBlackHole.getState, guideKeys);

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
    const ms = reduce ? 60 : Math.round(step.duration * 1000);
    const id = window.setTimeout(() => useBlackHole.getState().setGuideArrived(true), ms);
    return () => window.clearTimeout(id);
  }, [step, arrived, reduce]);

  return (
    <>
      <GuideSketch />
      <GuideCard
        label={tGuide("label")}
        kicker={tGuide("progressWith", {
          step: index + 1,
          total: steps.length,
          detail: step.kicker,
        })}
        stepKey={`${presetId}-${index}`}
        focusNext
        progress={{ step: index, total: steps.length }}
        controls={tourControls(tGuide, index, steps.length, useBlackHole.getState)}
      >
        <GuideTitle>{step.title}</GuideTitle>
        <GuideBody>{step.body}</GuideBody>
        {step.eq ? <GuideEquation>{step.eq}</GuideEquation> : null}
      </GuideCard>
    </>
  );
}
