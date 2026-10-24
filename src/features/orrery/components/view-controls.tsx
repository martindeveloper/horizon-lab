import { ArrowUpRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { HandoffLink, HandoffRow } from "@/components/simulations/handoff-link";
import { SwitchChips } from "@/components/simulations/switch-chips";
import { ViewPicker as SharedViewPicker } from "@/components/simulations/view-picker";
import { proseArgs } from "@/lib/facts";
import { SOLAR_VIEWS, solarViewById } from "@/space/solar-system/model/views";
import { atViewScale } from "@horizon/toolkit/camera";

import { PROSE_FIGURES } from "../lib/model/catalogue";
import { ORRERY_EDGE } from "../lib/scene/kit";
import { useOrrery, type Show } from "../lib/store";
import { ScaleGlyph } from "./scale-glyph";

export const DISPLAY: (keyof Show)[] = [
  "fromEarth",
  "elliptical",
  "trueSize",
  "faintRings",
  "names",
  "distances",
];
export const EXTRA: (keyof Show)[] = ["habitable", "plane"];

const VIEW_IDS = SOLAR_VIEWS.map((v) => v.id);

export function ViewPicker() {
  const t = useTranslations("orrery");
  const view = useOrrery((s) => s.view);
  const viewDist = useOrrery((s) => s.viewDist);
  const closeUp = useOrrery((s) => s.closeUp);
  const setView = useOrrery((s) => s.setView);
  const figures = proseArgs(PROSE_FIGURES, useLocale());
  return (
    <SharedViewPicker
      ariaLabel={t("hud.views")}
      label={t(`views.${view}`)}
      icon={<ScaleGlyph id={view} />}
      ids={VIEW_IDS}
      route
      selected={(id) => !closeUp && view === id && atViewScale(viewDist, solarViewById(id).dist)}
      labelOf={(id) => t(`views.${id}`)}
      hintOf={(id) => t(`viewHints.${id}`, figures)}
      iconOf={(id) => <ScaleGlyph id={id} />}
      onPick={setView}
    >
      <DeepFieldLink className="mt-1 border-t border-border pt-3" />
    </SharedViewPicker>
  );
}

export function Switches({ keys, list = false }: { keys: (keyof Show)[]; list?: boolean }) {
  const t = useTranslations("orrery");
  const show = useOrrery((s) => s.show);
  return (
    <SwitchChips
      list={list}
      keys={keys}
      values={show}
      label={(key) => t(`toggles.${key}`)}
      onToggle={(key) => useOrrery.getState().patchShow({ [key]: !show[key] })}
    />
  );
}

/** The same view in Deep Field, today, where the zoom carries on past the Oort cloud. */
function DeepFieldLink({ className }: { className?: string }) {
  const t = useTranslations("orrery");
  const view = useOrrery((s) => s.view);
  return (
    <HandoffRow
      to="deep-field"
      view={view}
      title={t("hud.deepField")}
      hint={t("hud.deepFieldHint")}
      {...(className ? { className } : {})}
    />
  );
}

export function EdgeChip() {
  const t = useTranslations("orrery");
  const atEdge = useOrrery((s) => !s.closeUp && s.viewDist >= ORRERY_EDGE * 0.8);
  if (!atEdge) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-16 z-30 flex anim-fade justify-center md:top-20">
      <HandoffLink
        to="deep-field"
        view="oort"
        className="glass-hud pointer-events-auto inline-flex h-11 items-center gap-2 rounded-full px-4 text-ui tracking-wide text-fg-primary ui-focus transition-colors duration-feedback ease-standard md:h-8 enabled-hover:text-accent"
      >
        {t("hud.keepGoing")}
        <ArrowUpRight className="icon size-icon-compact text-accent" aria-hidden />
      </HandoffLink>
    </div>
  );
}
