import { Crosshair } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { MapScale } from "@/components/simulations/map-readouts";
import { SimulationToolbar } from "@/components/simulations/simulation-toolbar";
import { useGuideFocusReturn } from "@/components/simulations/use-guide-focus-return";
import { useGuideKeys } from "@/components/simulations/use-guide-keys";
import { useSceneEscape, type EscapeStep } from "@/components/simulations/use-scene-escape";
import { proseArgs } from "@/lib/facts";
import { asideOpen } from "@/lib/scene-store";
import { VisualizationOverlay, cn } from "@horizon/toolkit/ui";

import { PROSE_FIGURES } from "../lib/model/catalogue";
import { useDeepField, type DeepFieldStore } from "../lib/store";
import { DepthLadder } from "./depth-ladder";
import { DeepFieldGuide } from "./guide";
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

/* During the journey, Space pauses and the arrows step, when no control wants them. */
const guideKeys = { onSpace: (api: DeepFieldStore) => api.toggleGuidePlaying() };

export function DeepFieldOverlay() {
  const t = useTranslations("deepField");
  const locale = useLocale();
  const ready = useDeepField((s) => s.ready);
  const view = useDeepField((s) => s.view);
  const panel = useDeepField((s) => s.panel);
  const setPanel = useDeepField((s) => s.setPanel);
  const selection = useDeepField((s) => s.selection);
  const guideOpen = useDeepField((s) => s.guideOpen);
  const scalePx = useDeepField((s) => s.scalePx);
  const scaleValue = useDeepField((s) => s.scaleValue);
  const scaleUnit = useDeepField((s) => s.scaleUnit);
  const aside = asideOpen({ panel, selection });
  const guideButton = useGuideFocusReturn(guideOpen);

  useSceneEscape(escapeSteps);
  useGuideKeys(useDeepField.getState, guideKeys);

  return (
    <VisualizationOverlay
      className={cn("transition-opacity duration-500", ready ? "opacity-100" : "opacity-0")}
      inert={!ready}
    >
      {guideOpen ? (
        <DeepFieldGuide />
      ) : (
        <>
          <header className="hud-top pad-hud-top absolute inset-x-0 top-0 z-[60] pb-6 md:pb-10">
            <div className="flex items-start gap-3">
              <div className="min-w-0 pt-1">
                <p className="hud-title truncate text-sm font-medium text-fg">
                  {t(`views.${view}`)}
                </p>
                <p className="mt-0.5 line-clamp-2 max-w-md text-xs text-muted not-md:hidden">
                  {t(`viewHints.${view}`, proseArgs(PROSE_FIGURES, locale))}
                </p>
              </div>
              <SimulationToolbar
                label={t("hud.controls")}
                details={(access) => <DeepFieldTechnicalDetails {...access} />}
                detailsLabel={t("technicalDetails.open")}
                guide={{ onSelect: () => useDeepField.getState().startGuide() }}
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
                drift={() => useDeepField.getState().startDrift()}
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
