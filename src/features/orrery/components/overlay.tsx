import { BookOpen, List, Orbit } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { SimulationImmersiveToggle } from "@/components/simulations/immersive";
import {
  IconButton,
  Toolbar,
  Tooltip,
  VisualizationOverlay,
  cn,
  isSceneShortcut,
} from "@horizon/toolkit/ui";

import { sliderToYearsAgo, yearsAgoToSlider } from "../lib/model/timeline";
import { useOrrery } from "../lib/store";
import { GuideCard } from "./guide";
import { ObjectsPanel } from "./objects-panel";
import { ReadingPanel } from "./reading-panel";
import { SelectionCard } from "./selection-card";
import { OrreryTechnicalDetails } from "./technical-details";
import { TimeDock } from "./time-dock";
import { ViewPicker } from "./view-controls";

export function OrreryOverlay() {
  const t = useTranslations("orrery");
  const ready = useOrrery((s) => s.ready);
  const panel = useOrrery((s) => s.panel);
  const setPanel = useOrrery((s) => s.setPanel);
  const selection = useOrrery((s) => s.selection);
  const closeUp = useOrrery((s) => s.closeUp);
  const guideOpen = useOrrery((s) => s.guideOpen);
  const guideButton = useRef<HTMLButtonElement>(null);

  const hadGuide = useRef(false);

  /* The entry button unmounts with the toolbar; hand focus back to it after the tour. */
  useEffect(() => {
    if (hadGuide.current && !guideOpen) guideButton.current?.focus({ preventScroll: true });
    hadGuide.current = guideOpen;
  }, [guideOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Escape may come from a control; Space and arrows only when no control wants them.
      if (!isSceneShortcut(e, { controls: e.key === "Escape" })) return;
      const api = useOrrery.getState();
      if (api.guideOpen) {
        if (e.key === "Escape") api.endGuide();
        else if (e.key === " ") {
          e.preventDefault();
          if (!e.repeat) api.goGuide(api.guideStep + 1);
        } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          api.goGuide(api.guideStep + (e.key === "ArrowRight" ? 1 : -1));
        }
        return;
      }
      if (e.key === "Escape") {
        if (api.panel !== "none") api.setPanel("none");
        else if (api.closeUp) api.leaveCloseUp();
        else if (api.selection) api.select(null);
        return;
      }
      if (e.key === " " || e.key === "ArrowLeft" || e.key === "ArrowRight") e.preventDefault();
      if (e.key === " ") api.togglePlay();
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const u = yearsAgoToSlider(api.yearsAgo);
        api.setYearsAgo(sliderToYearsAgo(u + (e.key === "ArrowRight" ? 0.025 : -0.025)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <VisualizationOverlay
      className={cn("transition-opacity duration-500", ready ? "opacity-100" : "opacity-0")}
      inert={!ready}
    >
      {guideOpen ? <GuideCard /> : null}

      {guideOpen ? null : (
        <>
          <header className="hud-top pad-hud-top absolute inset-x-0 top-0 z-[60] pb-6 md:pb-10">
            <div className="flex items-center gap-3">
              <ViewPicker />
              <Toolbar aria-label={t("hud.controls")} className="ml-auto shrink-0">
                <OrreryTechnicalDetails />
                <Tooltip label={t("hud.guide")}>
                  <IconButton
                    ref={guideButton}
                    aria-label={t("tour.start")}
                    onClick={() => useOrrery.getState().startGuide()}
                  >
                    <Orbit className="size-4 md:size-3.5" />
                  </IconButton>
                </Tooltip>
                <Tooltip label={t("hud.objects")}>
                  <IconButton
                    aria-label={t("hud.objects")}
                    aria-expanded={panel === "objects"}
                    aria-controls={panel === "objects" ? "orrery-objects" : undefined}
                    active={panel === "objects"}
                    onClick={() => setPanel(panel === "objects" ? "none" : "objects")}
                  >
                    <List className="size-4 md:size-3.5" />
                  </IconButton>
                </Tooltip>
                <Tooltip label={t("guide.title")}>
                  <IconButton
                    aria-label={t("guide.title")}
                    aria-expanded={panel === "reading"}
                    aria-controls={panel === "reading" ? "orrery-reading" : undefined}
                    active={panel === "reading"}
                    onClick={() => setPanel(panel === "reading" ? "none" : "reading")}
                  >
                    <BookOpen className="size-4 md:size-3.5" />
                  </IconButton>
                </Tooltip>
                <SimulationImmersiveToggle />
              </Toolbar>
            </div>
          </header>

          {panel === "objects" ? <ObjectsPanel onClose={() => setPanel("none")} /> : null}
          {panel === "reading" ? <ReadingPanel onClose={() => setPanel("none")} /> : null}
          {/* Remounts on entering or leaving a close-up, so the card starts folded or whole. */}
          {panel === "none" && selection ? (
            <SelectionCard key={closeUp ? "close-up" : "card"} />
          ) : null}
          {panel === "none" && !selection ? (
            <TimeDock />
          ) : (
            <div className="hidden md:block">
              <TimeDock />
            </div>
          )}
        </>
      )}
    </VisualizationOverlay>
  );
}
