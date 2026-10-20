import { Crosshair } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { MapScale } from "@/components/simulations/map-readouts";
import { SimulationToolbar } from "@/components/simulations/simulation-toolbar";
import { useGuideFocusReturn } from "@/components/simulations/use-guide-focus-return";
import { useSceneEscape, type EscapeStep } from "@/components/simulations/use-scene-escape";
import { VisualizationOverlay, cn, isSceneShortcut } from "@horizon/toolkit/ui";

import { useDeepField } from "../lib/store";
import { DepthLadder } from "./depth-ladder";
import { GuideCaption } from "./guide";
import { ObjectsPanel } from "./objects-panel";
import { SelectionCard } from "./selection-card";
import { Sightline } from "./sightline";
import { DeepFieldTechnicalDetails } from "./technical-details";
import { ViewPanel } from "./view-panel";

/** Escape ends the journey, else closes the panel, else lets go of the selection. */
const escapeSteps = (): EscapeStep[] => {
  const api = useDeepField.getState();
  return [
    [api.guideOpen, api.endGuide],
    [api.panel !== "none", () => api.setPanel("none")],
    [api.selection !== null, () => api.select(null)],
  ];
};

export function DeepFieldOverlay() {
  const t = useTranslations("deepField");
  const ready = useDeepField((s) => s.ready);
  const view = useDeepField((s) => s.view);
  const panel = useDeepField((s) => s.panel);
  const setPanel = useDeepField((s) => s.setPanel);
  const selection = useDeepField((s) => s.selection);
  const guideOpen = useDeepField((s) => s.guideOpen);
  const scalePx = useDeepField((s) => s.scalePx);
  const scaleValue = useDeepField((s) => s.scaleValue);
  const scaleUnit = useDeepField((s) => s.scaleUnit);
  const aside = panel !== "none" || selection !== null;
  const guideButton = useGuideFocusReturn(guideOpen);

  useSceneEscape(escapeSteps);
  /* During the journey, Space pauses and the arrows step, when no control wants them. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const api = useDeepField.getState();
      if (!api.guideOpen || !isSceneShortcut(e)) return;
      if (e.key === " ") {
        e.preventDefault();
        if (!e.repeat) api.toggleGuidePlaying();
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        api.goGuide(api.guideStep + (e.key === "ArrowRight" ? 1 : -1));
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
      {guideOpen ? (
        <GuideCaption />
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
                details={(access) => <DeepFieldTechnicalDetails {...access} />}
                detailsLabel={t("technicalDetails.open")}
                guide={{
                  label: t("hud.guide"),
                  ariaLabel: t("tour.start"),
                  onSelect: () => useDeepField.getState().startGuide(),
                }}
                guideRef={guideButton}
                finder={{
                  id: "objects",
                  label: t("hud.objects"),
                  icon: Crosshair,
                  active: panel === "objects",
                  controls: "deep-field-objects",
                  onSelect: () => setPanel(panel === "objects" ? "none" : "objects"),
                }}
                settings={{
                  label: t("hud.view"),
                  active: panel === "view",
                  controls: "deep-field-view",
                  onSelect: () => setPanel(panel === "view" ? "none" : "view"),
                }}
              />
            </div>
          </header>
          {/* The map's scale sits under the ladder, where wide screens keep the depth instruments. */}
          <div className="pad-hud-bottom pointer-events-none absolute bottom-0 left-0 z-30 not-lg:hidden">
            <MapScale
              namespace="deepField"
              value={scaleValue}
              unit={scaleUnit}
              px={scalePx}
              onScene
              className="deep-field-sightline pointer-events-auto"
            />
          </div>
          {panel === "objects" ? <ObjectsPanel onClose={() => setPanel("none")} /> : null}
          {panel === "view" ? <ViewPanel onClose={() => setPanel("none")} /> : null}
          {panel === "none" && selection ? <SelectionCard /> : null}
        </>
      )}

      {/* The ladder stays through the journey on wide screens: its thumb is the way out. */}
      <div className={cn((aside || guideOpen) && "not-md:hidden")}>
        <DepthLadder />
      </div>
      {/* One mount in every state, so opening a card never rebuilds or moves the sightline. */}
      <Sightline />
    </VisualizationOverlay>
  );
}
