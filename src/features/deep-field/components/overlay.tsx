import { Crosshair } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { useHelp } from "@/components/simulations/help-tour";
import { MapScale } from "@/components/simulations/map-readouts";
import { SimulationToolbar } from "@/components/simulations/simulation-toolbar";
import { useGuideFocusReturn } from "@/components/simulations/use-guide-focus-return";
import { useGuideKeys } from "@/components/simulations/use-guide-keys";
import { useSceneEscape, type EscapeStep } from "@/components/simulations/use-scene-escape";
import { proseArgs } from "@/lib/facts";
import { asideOpen } from "@/lib/scene-store";
import { LoadingBadge, VisualizationOverlay, cn } from "@horizon/toolkit/ui";

import { HELP } from "../lib/help";
import { PROSE_FIGURES } from "../lib/model/catalogue";
import { useDeepField, type DeepFieldStore } from "../lib/store";
import { AtlasLegend } from "./atlas-legend";
import { CmbLegend } from "./cmb";
import { DarkUniversePanel, HaloLegend } from "./dark-universe";
import { DepthLadder } from "./depth-ladder";
import { DeepFieldGuide } from "./guide";
import { CaptionSlot } from "./header-caption";
import { ObjectsPanel } from "./objects-panel";
import { SelectionCard } from "./selection-card";
import { Sightline } from "./sightline";
import { DeepFieldTechnicalDetails } from "./technical-details";
import { ViewPanel } from "./view-panel";

/** Escape ends the journey, else closes the panel, leaves a close-up or lets go, in that order. */
const escapeSteps = (): EscapeStep[] => {
  const api = useDeepField.getState();
  return [
    [api.guideOpen, api.endGuide],
    [api.panel !== "none", () => api.setPanel("none")],
    [api.closeUp !== null, api.leaveCloseUp],
    [api.selection !== null, () => api.select(null)],
  ];
};

/* During the journey, Space pauses and the arrows step, when no control wants them. */
const guideKeys = { onSpace: (api: DeepFieldStore) => api.toggleGuidePlaying() };

const helpStore = { getState: useDeepField.getState, subscribe: useDeepField.subscribe };

export function DeepFieldOverlay() {
  const t = useTranslations("deepField");
  const locale = useLocale();
  const ready = useDeepField((s) => s.ready);
  const view = useDeepField((s) => s.view);
  const panel = useDeepField((s) => s.panel);
  const setPanel = useDeepField((s) => s.setPanel);
  const selection = useDeepField((s) => s.selection);
  const guideOpen = useDeepField((s) => s.guideOpen);
  const sharpening = useDeepField((s) => s.sharpening);
  const scalePx = useDeepField((s) => s.scalePx);
  const scaleValue = useDeepField((s) => s.scaleValue);
  const scaleUnit = useDeepField((s) => s.scaleUnit);
  const aside = asideOpen({ panel, selection });
  const guideButton = useGuideFocusReturn(guideOpen);
  const help = useHelp(helpStore, HELP, "deepField");

  useSceneEscape(escapeSteps);
  useGuideKeys(useDeepField.getState, guideKeys);

  return (
    <VisualizationOverlay ready={ready}>
      {guideOpen ? (
        <DeepFieldGuide />
      ) : (
        <>
          <header className="hud-top pad-hud-top absolute inset-x-0 top-0 z-[60]">
            <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
              <CaptionSlot>
                {/* Only views that draw a mark the eye can't name (a ring, a path, a shell) caption
                    it; the keys follow for what is drawn at the depth. */}
                {t.has(`viewHints.${view}`) ? (
                  <p className="line-clamp-2 max-w-md min-w-0 text-space-muted not-md:hidden">
                    {t(`viewHints.${view}`, proseArgs(PROSE_FIGURES, locale))}
                  </p>
                ) : null}
                <AtlasLegend />
                <HaloLegend />
                <CmbLegend />
              </CaptionSlot>
              <SimulationToolbar
                label={t("hud.controls")}
                help={help}
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
            {/* Match the ladder's width-only breakpoint, including landscape phones: the status
                stays clear of its track and rung labels. */}
            <div className="min-[48rem]:pl-48">
              <LoadingBadge label={t("hud.sharpening")} visible={sharpening} className="mt-2" />
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
          {panel === "dark" ? <DarkUniversePanel onClose={() => setPanel("none")} /> : null}
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
