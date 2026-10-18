import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { HandoffLink, HandoffRow } from "@/components/simulations/handoff-link";
import { SwitchChips } from "@/components/simulations/switch-chips";
import { SOLAR_VIEWS } from "@/space/solar-system/model/views";
import { atViewScale } from "@horizon/toolkit/camera";
import { ListItem, Picker } from "@horizon/toolkit/ui";

import { ORRERY_EDGE } from "../lib/scene/kit";
import { useOrrery, type Show } from "../lib/store";

export const DISPLAY: (keyof Show)[] = ["elliptical", "trueSize", "drift", "names", "distances"];
export const EXTRA: (keyof Show)[] = ["plane"];

export function ViewPicker() {
  const t = useTranslations("orrery");
  const view = useOrrery((s) => s.view);
  const viewDist = useOrrery((s) => s.viewDist);
  const closeUp = useOrrery((s) => s.closeUp);
  const setView = useOrrery((s) => s.setView);
  const [open, setOpen] = useState(false);
  return (
    <Picker
      label={t(`views.${view}`)}
      aria-label={t("hud.views")}
      open={open}
      onOpenChange={setOpen}
      triggerClassName="relative max-w-[min(16rem,100%)] not-md:h-10 not-md:after:absolute not-md:after:inset-x-0 not-md:after:-inset-y-0.5"
    >
      <div className="flex flex-col gap-1">
        {SOLAR_VIEWS.map((v) => (
          <ListItem
            key={v.id}
            selected={!closeUp && view === v.id && atViewScale(viewDist, v.dist)}
            onClick={() => {
              setView(v.id);
              setOpen(false);
            }}
            className="flex-col items-start justify-start gap-0"
          >
            <span>{t(`views.${v.id}`)}</span>
            <span className="text-xs text-muted">{t(`viewHints.${v.id}`)}</span>
          </ListItem>
        ))}
        <DeepFieldLink className="mt-1 border-t border-border pt-3" />
      </div>
    </Picker>
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

/** Pulled out against the Orrery's edge: one quiet way on into Deep Field. */
export function EdgeChip() {
  const t = useTranslations("orrery");
  const atEdge = useOrrery((s) => !s.closeUp && s.viewDist >= ORRERY_EDGE * 0.8);
  if (!atEdge) return null;
  return (
    <div className="anim-fade pointer-events-none absolute inset-x-0 top-16 z-30 flex justify-center md:top-20">
      <HandoffLink
        to="deep-field"
        view="oort"
        className="glass-hud pointer-events-auto inline-flex h-11 items-center gap-2 rounded-full px-4 text-xs tracking-wide text-fg transition-colors hover:text-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden md:h-8"
      >
        {t("hud.keepGoing")}
        <ArrowUpRight className="size-3.5 text-accent" aria-hidden />
      </HandoffLink>
    </div>
  );
}
