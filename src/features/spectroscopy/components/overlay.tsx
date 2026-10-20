"use client";

import { Atom } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { SimulationToolbar } from "@/components/simulations/simulation-toolbar";
import { useGuideFocusReturn } from "@/components/simulations/use-guide-focus-return";
import { useSceneEscape, type EscapeStep } from "@/components/simulations/use-scene-escape";
import { usePathname, useRouter } from "@/i18n/navigation";
import { ListItem, Picker, VisualizationOverlay, cn, kickerClass } from "@horizon/toolkit/ui";

import { VIEW_IDS, type ViewId } from "../lib/model/view-ids";
import { useSpectroscopy } from "../lib/store";
import { pathForView } from "../routing";
import { SpectroscopyDock } from "./dock";
import { GuideCaption } from "./guide";
import { LineCard } from "./line-card";
import { ElementsPanel, ViewPanel } from "./panels";
import { SpectroscopyTechnicalDetails } from "./technical-details";

/** Escape ends the guide, else closes the panel, else lets go of the line. */
const escapeSteps = (): EscapeStep[] => {
  const api = useSpectroscopy.getState();
  return [
    [api.guideOpen, api.endGuide],
    [api.panel !== "none", () => api.setPanel("none")],
    [api.selection !== null, () => api.select(null)],
  ];
};

/** The four views, as a pill that opens a list. */
function ViewPicker() {
  const t = useTranslations("spectroscopy");
  const view = useSpectroscopy((s) => s.view);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const go = (id: ViewId) => {
    setOpen(false);
    const path = pathForView(id);
    if (pathname !== path) router.push(path, { scroll: false });
  };
  return (
    <Picker
      aria-label={t("hud.views")}
      label={t(`views.${view}.title`)}
      detail={t(`views.${view}.kicker`)}
      open={open}
      onOpenChange={setOpen}
    >
      <div className="flex flex-col gap-1">
        {VIEW_IDS.map((id) => (
          <ListItem key={id} selected={id === view} onClick={() => go(id)}>
            <span className="min-w-0">
              <span className="block truncate">{t(`views.${id}.title`)}</span>
              <span className="block truncate text-xs text-muted">{t(`views.${id}.hint`)}</span>
            </span>
            <span className={cn(kickerClass, "shrink-0")}>{t(`views.${id}.kicker`)}</span>
          </ListItem>
        ))}
      </div>
    </Picker>
  );
}

export function SpectroscopyOverlay() {
  const t = useTranslations("spectroscopy");
  const ready = useSpectroscopy((s) => s.ready);
  const view = useSpectroscopy((s) => s.view);
  const panel = useSpectroscopy((s) => s.panel);
  const selection = useSpectroscopy((s) => s.selection);
  const guideOpen = useSpectroscopy((s) => s.guideOpen);
  const guideButton = useGuideFocusReturn(guideOpen);
  const api = useSpectroscopy.getState;
  useSceneEscape(escapeSteps);

  return (
    <VisualizationOverlay
      className={cn("transition-opacity duration-500", ready ? "opacity-100" : "opacity-0")}
      inert={!ready}
    >
      {guideOpen ? null : (
        <header className="hud-top pad-hud-top anim-fade absolute inset-x-0 top-0 z-[60]">
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <ViewPicker />
              <p className="line-clamp-2 max-w-md text-xs text-muted not-lg:hidden">
                {t(`views.${view}.hint`)}
              </p>
            </div>
            <SimulationToolbar
              label={t("hud.controls")}
              details={(access) => <SpectroscopyTechnicalDetails {...access} />}
              detailsLabel={t("technicalDetails.open")}
              guide={{
                label: t("hud.guide"),
                ariaLabel: t("tour.start"),
                onSelect: () => api().startGuide(),
              }}
              guideRef={guideButton}
              finder={{
                id: "elements",
                label: t("hud.elements"),
                icon: Atom,
                active: panel === "elements",
                controls: "spectroscopy-elements",
                onSelect: () => api().setPanel(panel === "elements" ? "none" : "elements"),
              }}
              settings={{
                label: t("hud.view"),
                active: panel === "view",
                controls: "spectroscopy-view",
                onSelect: () => api().setPanel(panel === "view" ? "none" : "view"),
              }}
            />
          </div>
        </header>
      )}
      {!guideOpen && panel === "elements" ? (
        <ElementsPanel onClose={() => api().setPanel("none")} />
      ) : null}
      {!guideOpen && panel === "view" ? <ViewPanel onClose={() => api().setPanel("none")} /> : null}
      {panel === "none" && selection ? (
        <div className={cn(guideOpen && "not-md:hidden")}>
          <LineCard />
        </div>
      ) : null}
      {guideOpen ? <GuideCaption /> : <SpectroscopyDock />}
    </VisualizationOverlay>
  );
}
