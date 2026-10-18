import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import {
  GuideBody,
  GuideCard as SharedGuideCard,
  GuideEquation,
  GuideTitle,
} from "@/components/simulations/guide-card";
import { HandoffLink } from "@/components/simulations/handoff-link";
import { proseArgs } from "@/lib/facts";
import { actionClass } from "@horizon/toolkit/ui";

import { PROSE_FIGURES } from "../lib/model/catalogue";
import { TOUR } from "../lib/model/tour";
import { useOrrery } from "../lib/store";
import { formatYearsAgo } from "./format";

/** The tour card: one concept per step, on the shared guide card. The scene flies the camera. */
export function GuideCard() {
  const t = useTranslations("orrery");
  const f = useFormatter();
  const figures = proseArgs(PROSE_FIGURES, useLocale());
  const index = useOrrery((s) => s.guideStep);
  const yearsAgo = useOrrery((s) => s.yearsAgo);
  const playing = useOrrery((s) => s.playing);
  const view = useOrrery((s) => s.view);
  const next = useRef<HTMLButtonElement>(null);
  const step = TOUR[index] ?? TOUR[0]!;
  const last = index >= TOUR.length - 1;
  const api = useOrrery.getState;

  useEffect(() => {
    next.current?.focus({ preventScroll: true });
  }, []);

  return (
    <SharedGuideCard
      label={t("tour.label")}
      kicker={t("tour.progress", {
        step: index + 1,
        total: TOUR.length,
        time: formatYearsAgo(t, f, yearsAgo),
      })}
      stepKey={step.id}
      nextRef={next}
      controls={{
        previous: {
          label: t("tour.previous"),
          disabled: index === 0,
          onClick: () => api().goGuide(index - 1),
        },
        /* The tour may run the clock; it can always be stopped. */
        play:
          playing || step.playing
            ? {
                label: playing ? t("hud.pause") : t("hud.play"),
                playing,
                onClick: () => api().togglePlay(),
              }
            : undefined,
        extra: last ? (
          <HandoffLink
            to="deep-field"
            view={view}
            onClick={() => api().endGuide()}
            className={actionClass("ghost", "px-3")}
          >
            {t("tour.further")}
          </HandoffLink>
        ) : null,
        next: {
          label: last ? t("tour.finish") : t("tour.next"),
          last,
          onClick: () => api().goGuide(index + 1),
        },
        exit: { label: t("tour.exit"), onClick: () => api().endGuide() },
      }}
    >
      <GuideTitle>{t(`tour.steps.${step.id}.title`, figures)}</GuideTitle>
      <GuideBody>{t(`tour.steps.${step.id}.body`, figures)}</GuideBody>
      {step.eq ? (
        <GuideEquation>
          {t(`tour.steps.${step.id}.eq`, { equation: step.equation?.toString() ?? "" })}
        </GuideEquation>
      ) : null}
    </SharedGuideCard>
  );
}
