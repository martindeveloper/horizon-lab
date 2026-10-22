"use client";

import { useTranslations } from "next-intl";

import { ViewPicker as SharedViewPicker } from "@/components/simulations/view-picker";

import { VIEW_IDS } from "../lib/model/views";
import { useSun } from "../lib/store";

export function SunViewPicker() {
  const t = useTranslations("sun");
  const view = useSun((s) => s.view);
  return (
    <SharedViewPicker
      ariaLabel={t("hud.views")}
      label={t(`views.${view}`)}
      className="min-w-36 flex-1"
      triggerClassName="relative max-w-[min(16rem,100%)] not-md:h-10 not-md:after:absolute not-md:after:inset-x-0 not-md:after:-inset-y-0.5"
      ids={VIEW_IDS}
      selected={(id) => id === view}
      labelOf={(id) => t(`views.${id}`)}
      hintOf={(id) => t(`viewHints.${id}`)}
      onPick={(id) => {
        if (id !== view) useSun.getState().setView(id);
      }}
    />
  );
}
