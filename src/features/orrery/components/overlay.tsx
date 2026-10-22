import { BookOpen, Crosshair } from "lucide-react";
import { useTranslations } from "next-intl";

import { useHelp } from "@/components/simulations/help-tour";
import { SimulationToolbar } from "@/components/simulations/simulation-toolbar";
import { useGuideFocusReturn } from "@/components/simulations/use-guide-focus-return";
import { useGuideKeys } from "@/components/simulations/use-guide-keys";
import { useSceneEscape, type EscapeStep } from "@/components/simulations/use-scene-escape";
import { LoadingBadge, VisualizationOverlay, cn } from "@horizon/toolkit/ui";

import { HELP } from "../lib/help";
import { sliderToYearsAgo, yearsAgoToSlider } from "../lib/model/timeline";
import { useOrrery, type OrreryStore } from "../lib/store";
import { OrreryGuide } from "./guide";
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
    [api.closeUp !== null, () => api.leaveCloseUp()],
    [api.selection !== null, () => api.select(null)],
  ];
};

/** During the tour, Space steps on and the arrows step either way; otherwise they run the clock. */
const guideKeys = {
  onSpace: (api: OrreryStore) => api.goGuide(api.guideStep + 1),
  otherwise: (e: KeyboardEvent, api: OrreryStore) => {
    if (e.key === " " || e.key === "ArrowLeft" || e.key === "ArrowRight") e.preventDefault();
    if (e.key === " ") api.togglePlay();
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const u = yearsAgoToSlider(api.yearsAgo);
      api.setYearsAgo(sliderToYearsAgo(u + (e.key === "ArrowRight" ? 0.025 : -0.025)));
    }
  },
};

const helpStore = { getState: useOrrery.getState, subscribe: useOrrery.subscribe };

export function OrreryOverlay() {
  const t = useTranslations("orrery");
  const ready = useOrrery((s) => s.ready);
  const panel = useOrrery((s) => s.panel);
  const setPanel = useOrrery((s) => s.setPanel);
  const selection = useOrrery((s) => s.selection);
  const closeUp = useOrrery((s) => s.closeUp);
  const drift = useOrrery((s) => s.drift);
  const guideOpen = useOrrery((s) => s.guideOpen);
  const sharpening = useOrrery((s) => s.sharpening);
  const guideButton = useGuideFocusReturn(guideOpen);
  const help = useHelp(helpStore, HELP, "orrery");

  useSceneEscape(escapeSteps);
  useGuideKeys(useOrrery.getState, guideKeys);

  return (
    <VisualizationOverlay
      className={cn("transition-opacity duration-500", ready ? "opacity-100" : "opacity-0")}
      inert={!ready}
    >
      {guideOpen ? <OrreryGuide /> : null}

      {guideOpen ? null : (
        <>
          <header className="hud-top pad-hud-top absolute inset-x-0 top-0 z-[60] pb-6 md:pb-10">
            {/* The view's name gives way to the tools down to its minimum; phones under 360px
                take the tools a row lower. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <ViewPicker />
              <SimulationToolbar
                label={t("hud.controls")}
                help={help}
                details={(access) => <OrreryTechnicalDetails {...access} />}
                detailsLabel={t("technicalDetails.open")}
                guide={{ onSelect: () => useOrrery.getState().startGuide() }}
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
                drift={() => useOrrery.getState().startDrift()}
              />
            </div>
            <LoadingBadge label={t("hud.sharpening")} visible={sharpening} className="mt-2" />
          </header>

          {panel === "objects" ? <ObjectsPanel onClose={() => setPanel("none")} /> : null}
          {panel === "view" ? <ViewPanel onClose={() => setPanel("none")} /> : null}
          {panel === "reading" ? <ReadingPanel onClose={() => setPanel("none")} /> : null}
          {/* Remounts on entering or leaving a close-up, so the card starts folded or whole. */}
          {panel === "none" && selection && drift === "off" ? (
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
