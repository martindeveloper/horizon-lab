import { Crosshair } from "lucide-react";
import { useTranslations } from "next-intl";

import { SimulationToolbar } from "@/components/simulations/simulation-toolbar";
import { useGuideFocusReturn } from "@/components/simulations/use-guide-focus-return";
import { useGuideKeys } from "@/components/simulations/use-guide-keys";
import { useSceneEscape, type EscapeStep } from "@/components/simulations/use-scene-escape";
import { VisualizationOverlay, cn } from "@horizon/toolkit/ui";

import { useVoyage, type VoyageStore } from "../lib/store";
import { FlightDock } from "./flight-dock";
import { VoyageGuide } from "./guide";
import { ObjectsPanel } from "./objects-panel";
import { SelectionCard } from "./selection-card";
import { VoyageTechnicalDetails } from "./technical-details";
import { ViewPanel } from "./view-panel";

/** Escape ends the journey, else closes the panel, else lets go of the selection. */
const escapeSteps = (): EscapeStep[] => {
  const api = useVoyage.getState();
  return [
    [api.guideOpen, api.endGuide],
    [api.panel !== "none", () => api.setPanel("none")],
    [api.selection !== null, () => api.select(null)],
  ];
};

/*
 * During the journey Space pauses it; parked, Space holds and runs the clocks. In free flight
 * Space is the ship's (it parks), so the clocks are left to the dock's button.
 */
const guideKeys = {
  onSpace: (api: VoyageStore) => api.toggleGuidePlaying(),
  otherwise: (event: KeyboardEvent, api: VoyageStore) => {
    if (event.key !== " " || event.repeat || api.mode === "free") return;
    event.preventDefault();
    api.toggleHold();
  },
};

export function VoyageOverlay() {
  const t = useTranslations("voyage");
  const ready = useVoyage((s) => s.ready);
  const view = useVoyage((s) => s.view);
  const panel = useVoyage((s) => s.panel);
  const setPanel = useVoyage((s) => s.setPanel);
  const selection = useVoyage((s) => s.selection);
  const guideOpen = useVoyage((s) => s.guideOpen);
  const guideButton = useGuideFocusReturn(guideOpen);

  useSceneEscape(escapeSteps);
  useGuideKeys(useVoyage.getState, guideKeys);

  return (
    <VisualizationOverlay
      className={cn("transition-opacity duration-500", ready ? "opacity-100" : "opacity-0")}
      inert={!ready}
    >
      {guideOpen ? (
        <VoyageGuide />
      ) : (
        <>
          <header className="hud-top pad-hud-top absolute inset-x-0 top-0 z-[60] pb-6 md:pb-10">
            <div className="flex items-start gap-3">
              <div className="min-w-0 pt-1">
                <p className="hud-title truncate text-sm font-medium text-fg">
                  {t(`views.${view}`)}
                </p>
                <p className="mt-0.5 line-clamp-2 max-w-md text-xs text-muted not-md:hidden">
                  {t(`viewHints.${view}`)}
                </p>
              </div>
              <SimulationToolbar
                label={t("hud.controls")}
                details={(access) => <VoyageTechnicalDetails {...access} />}
                detailsLabel={t("technicalDetails.open")}
                guide={{
                  label: t("hud.guide"),
                  ariaLabel: t("tour.start"),
                  onSelect: () => useVoyage.getState().startGuide(),
                }}
                guideRef={guideButton}
                finder={{
                  id: "objects",
                  label: t("hud.objects"),
                  icon: Crosshair,
                  active: panel === "objects",
                  controls: "voyage-objects",
                  onSelect: () => setPanel(panel === "objects" ? "none" : "objects"),
                }}
                settings={{
                  label: t("hud.view"),
                  active: panel === "view",
                  controls: "voyage-view",
                  onSelect: () => setPanel(panel === "view" ? "none" : "view"),
                }}
              />
            </div>
          </header>
          {panel === "objects" ? <ObjectsPanel onClose={() => setPanel("none")} /> : null}
          {panel === "view" ? <ViewPanel onClose={() => setPanel("none")} /> : null}
          {panel === "none" && selection ? <SelectionCard /> : null}
        </>
      )}
      {/* One mount in every state, so opening a card never rebuilds or moves the dock. */}
      <FlightDock />
    </VisualizationOverlay>
  );
}
