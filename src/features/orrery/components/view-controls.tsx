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

export const DISPLAY: (keyof Show)[] = [
  "elliptical",
  "trueSize",
  "faintRings",
  "drift",
  "names",
  "distances",
];
export const EXTRA: (keyof Show)[] = ["plane"];

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
      className="min-w-36 flex-1"
      triggerClassName="relative max-w-[min(16rem,100%)] not-md:h-10 not-md:after:absolute not-md:after:inset-x-0 not-md:after:-inset-y-0.5"
      ids={VIEW_IDS}
      selected={(id) => !closeUp && view === id && atViewScale(viewDist, solarViewById(id).dist)}
      labelOf={(id) => t(`views.${id}`)}
      hintOf={(id) => t(`viewHints.${id}`, figures)}
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
        className="glass-hud pointer-events-auto inline-flex h-11 items-center gap-2 rounded-full px-4 text-ui tracking-wide text-fg-primary transition-colors duration-feedback ease-standard hover:text-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden md:h-8"
      >
        {t("hud.keepGoing")}
        <ArrowUpRight className="size-3.5 text-accent" aria-hidden />
      </HandoffLink>
    </div>
  );
}
