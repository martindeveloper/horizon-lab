import { BookOpen, Crosshair } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { SimulationToolbar } from "@/components/simulations/simulation-toolbar";
import { useGuideFocusReturn } from "@/components/simulations/use-guide-focus-return";
import { useSceneEscape, type EscapeStep } from "@/components/simulations/use-scene-escape";
import { VisualizationOverlay, cn, isSceneShortcut } from "@horizon/toolkit/ui";

import { sliderToYearsAgo, yearsAgoToSlider } from "../lib/model/timeline";
import { useOrrery } from "../lib/store";
import { GuideCard } from "./guide";
import { ObjectsPanel } from "./objects-panel";
import { ReadingPanel } from "./reading-panel";
import { SelectionCard } from "./selection-card";
import { OrreryTechnicalDetails } from "./technical-details";
import { TimeDock } from "./time-dock";
import { EdgeChip, ViewPicker } from "./view-controls";
import { ViewPanel } from "./view-panel";

/** Escape ends the guide, else closes the panel, leaves a close-up or lets go, in that order. */
const escapeSteps = (): EscapeStep[] => {
  const api = useOrrery.getState();
  return [
    [api.guideOpen, api.endGuide],
    [api.panel !== "none", () => api.setPanel("none")],
    [api.closeUp, api.leaveCloseUp],
    [api.selection !== null, () => api.select(null)],
  ];
};

export function OrreryOverlay() {
  const t = useTranslations("orrery");
  const ready = useOrrery((s) => s.ready);
  const panel = useOrrery((s) => s.panel);
  const setPanel = useOrrery((s) => s.setPanel);
  const selection = useOrrery((s) => s.selection);
  const closeUp = useOrrery((s) => s.closeUp);
  const guideOpen = useOrrery((s) => s.guideOpen);
  const guideButton = useGuideFocusReturn(guideOpen);

  useSceneEscape(escapeSteps);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Space and arrows only when no control wants them.
      if (!isSceneShortcut(e)) return;
      const api = useOrrery.getState();
      if (api.guideOpen) {
        if (e.key === " ") {
          e.preventDefault();
          if (!e.repeat) api.goGuide(api.guideStep + 1);
        } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          api.goGuide(api.guideStep + (e.key === "ArrowRight" ? 1 : -1));
        }
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
            {/* The view's name gives way to the tools down to its minimum; phones under 360px
                take the tools a row lower. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <ViewPicker />
              <SimulationToolbar
                label={t("hud.controls")}
                details={(access) => <OrreryTechnicalDetails {...access} />}
                detailsLabel={t("technicalDetails.open")}
                guide={{
                  label: t("hud.guide"),
                  ariaLabel: t("tour.start"),
                  onSelect: () => useOrrery.getState().startGuide(),
                }}
                guideRef={guideButton}
                finder={{
                  id: "objects",
                  label: t("hud.objects"),
                  icon: Crosshair,
                  active: panel === "objects",
                  controls: "orrery-objects",
                  onSelect: () => setPanel(panel === "objects" ? "none" : "objects"),
                }}
                tools={[
                  {
                    id: "reading",
                    label: t("guide.title"),
                    icon: BookOpen,
                    active: panel === "reading",
                    controls: "orrery-reading",
                    onSelect: () => setPanel(panel === "reading" ? "none" : "reading"),
                  },
                ]}
                settings={{
                  label: t("hud.view"),
                  active: panel === "view",
                  controls: "orrery-view",
                  onSelect: () => setPanel(panel === "view" ? "none" : "view"),
                }}
              />
            </div>
          </header>

          {panel === "objects" ? <ObjectsPanel onClose={() => setPanel("none")} /> : null}
          {panel === "view" ? <ViewPanel onClose={() => setPanel("none")} /> : null}
          {panel === "reading" ? <ReadingPanel onClose={() => setPanel("none")} /> : null}
          {/* Remounts on entering or leaving a close-up, so the card starts folded or whole. */}
          {panel === "none" && selection ? (
            <SelectionCard key={closeUp ? "close-up" : "card"} />
          ) : null}
          <EdgeChip />
          {/* One mount in every state, so opening a card never rebuilds or moves the dock. */}
          <TimeDock />
        </>
      )}
    </VisualizationOverlay>
  );
}
