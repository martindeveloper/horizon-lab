import { useFormatter, useLocale, useTranslations } from "next-intl";

import { tourControls } from "@/components/simulations/guide-caption";
import {
  GuideBody,
  GuideCard,
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
export function OrreryGuide() {
  const t = useTranslations("orrery");
  const tGuide = useTranslations("guide");
  const f = useFormatter();
  const locale = useLocale();
  const figures = proseArgs(PROSE_FIGURES, locale);
  const index = useOrrery((s) => s.guideStep);
  const yearsAgo = useOrrery((s) => s.yearsAgo);
  const playing = useOrrery((s) => s.playing);
  const view = useOrrery((s) => s.view);
  const step = TOUR[index] ?? TOUR[0]!;
  const last = index >= TOUR.length - 1;
  const api = useOrrery.getState;

  return (
    <GuideCard
      label={tGuide("label")}
      kicker={tGuide("progressWith", {
        step: index + 1,
        total: TOUR.length,
        detail: formatYearsAgo(t, f, yearsAgo, locale),
      })}
      stepKey={step.id}
      focusNext
      progress={{ step: index, total: TOUR.length }}
      controls={{
        ...tourControls(tGuide, index, TOUR.length, api),
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
      }}
    >
      <GuideTitle>{t(`tour.steps.${step.id}.title`, figures)}</GuideTitle>
      <GuideBody>{t(`tour.steps.${step.id}.body`, figures)}</GuideBody>
      {step.eq ? (
        <GuideEquation>
          {t(`tour.steps.${step.id}.eq`, { equation: step.equation?.toString() ?? "" })}
        </GuideEquation>
      ) : null}
    </GuideCard>
  );
}
