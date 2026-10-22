"use client";

import { Crosshair } from "lucide-react";
import { useTranslations } from "next-intl";

import { useHelp } from "@/components/simulations/help-tour";
import { SimulationToolbar } from "@/components/simulations/simulation-toolbar";
import { useGuideFocusReturn } from "@/components/simulations/use-guide-focus-return";
import { useGuideKeys } from "@/components/simulations/use-guide-keys";
import { useSceneEscape, type EscapeStep } from "@/components/simulations/use-scene-escape";
import { HeaderRow } from "@/components/simulations/view-picker";
import { LoadingBadge, VisualizationOverlay } from "@horizon/toolkit/ui";

import { HELP } from "../lib/help";
import { useSun, type SunStore } from "../lib/store";
import { PlaceCard } from "./card";
import { SunDock } from "./dock";
import { SunGuide } from "./guide";
import { PlacesPanel, ViewPanel } from "./panels";
import { SunTechnicalDetails } from "./technical-details";
import { SunViewPicker } from "./view-picker";

/** Escape ends the guide, else closes the panel, leaves the close-up or lets go, in that order. */
const escapeSteps = (): EscapeStep[] => {
  const api = useSun.getState();
  return [
    [api.guideOpen, api.endGuide],
    [api.panel !== "none", () => api.setPanel("none")],
    [api.closeUp, api.leaveCloseUp],
    [api.selection !== null, () => api.select(null)],
  ];
};

/* During the journey Space pauses it; outside, Space pauses the clock. */
const guideKeys = {
  onSpace: (api: SunStore) => api.toggleGuidePlaying(),
  otherwise: (event: KeyboardEvent, api: SunStore) => {
    if (event.key !== " " || event.repeat) return;
    event.preventDefault();
    api.togglePaused();
  },
};

const helpStore = { getState: useSun.getState, subscribe: useSun.subscribe };

export function SunOverlay() {
  const t = useTranslations("sun");
  const ready = useSun((s) => s.ready);
  const panel = useSun((s) => s.panel);
  const selection = useSun((s) => s.selection);
  const sharpening = useSun((s) => s.sharpening);
  const guideOpen = useSun((s) => s.guideOpen);
  const guideButton = useGuideFocusReturn(guideOpen);
  const help = useHelp(helpStore, HELP, "sun");
  const api = useSun.getState;

  useSceneEscape(escapeSteps);
  useGuideKeys(useSun.getState, guideKeys);

  return (
    <VisualizationOverlay ready={ready}>
      {guideOpen ? (
        <SunGuide />
      ) : (
        <>
          <header className="hud-top pad-hud-top absolute inset-x-0 top-0 z-[60]">
            <HeaderRow>
              <SunViewPicker />
              <SimulationToolbar
                label={t("hud.controls")}
                help={help}
                details={(access) => <SunTechnicalDetails {...access} />}
                detailsLabel={t("technicalDetails.open")}
                guide={{ onSelect: () => api().startGuide() }}
                guideRef={guideButton}
                finder={{
                  id: "finder",
                  label: t("hud.finder"),
                  icon: Crosshair,
                  active: panel === "places",
                  controls: "sun-places",
                  onSelect: () => api().setPanel(panel === "places" ? "none" : "places"),
                }}
                settings={{
                  label: t("hud.view"),
                  active: panel === "view",
                  controls: "sun-view",
                  onSelect: () => api().setPanel(panel === "view" ? "none" : "view"),
                }}
                drift={() => api().startDrift()}
              />
            </HeaderRow>
            <LoadingBadge label={t("hud.sharpening")} visible={sharpening} className="mt-2" />
          </header>
          {panel === "places" ? <PlacesPanel onClose={() => api().setPanel("none")} /> : null}
          {panel === "view" ? <ViewPanel onClose={() => api().setPanel("none")} /> : null}
          {panel === "none" && selection ? <PlaceCard id={selection} /> : null}
          <SunDock />
        </>
      )}
    </VisualizationOverlay>
  );
}
