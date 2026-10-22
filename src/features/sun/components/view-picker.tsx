"use client";

import { useTranslations } from "next-intl";

import { ViewPicker } from "@/components/simulations/view-picker";

import { VIEW_IDS } from "../lib/model/views";
import { useSun } from "../lib/store";
import { ViewGlyph } from "./sun-glyph";

export function SunViewPicker() {
  const t = useTranslations("sun");
  const view = useSun((s) => s.view);
  return (
    <ViewPicker
      ariaLabel={t("hud.views")}
      label={t(`views.${view}`)}
      icon={<ViewGlyph id={view} />}
      ids={VIEW_IDS}
      selected={(id) => id === view}
      labelOf={(id) => t(`views.${id}`)}
      hintOf={(id) => t(`viewHints.${id}`)}
      iconOf={(id) => <ViewGlyph id={id} />}
      onPick={(id) => {
        if (id !== view) useSun.getState().setView(id);
      }}
    />
  );
}
