import { Map } from "lucide-react";
import { useTranslations } from "next-intl";

import { useHelp } from "@/components/simulations/help-tour";
import { SimulationToolbar } from "@/components/simulations/simulation-toolbar";
import { useGuideFocusReturn } from "@/components/simulations/use-guide-focus-return";
import { useGuideKeys } from "@/components/simulations/use-guide-keys";
import { useSceneEscape, type EscapeStep } from "@/components/simulations/use-scene-escape";
import { VisualizationOverlay } from "@horizon/toolkit/ui";

import { HELP } from "../lib/help";
import { useAfterglow, type AfterglowStore } from "../lib/store";
import { AtlasPanel } from "./atlas";
import { AfterglowDock } from "./dock";
import { AfterglowGuide } from "./guide";
import { Readouts } from "./readouts";
import { SettingsPanel } from "./settings-panel";
import { AfterglowTechnicalDetails } from "./technical-details";
import { WorldCard } from "./world-card";

/** Escape ends the journey, else closes the atlas, the panel or the card, in that order. */
const escapeSteps = (): EscapeStep[] => {
  const api = useAfterglow.getState();
  return [
    [api.guideOpen, api.endGuide],
    [api.atlas, () => api.setAtlas(false)],
    [api.panel !== "none", () => api.setPanel("none")],
    [api.selection !== null, () => api.select(null)],
  ];
};

/* During the journey Space pauses it; otherwise Space plays and pauses the clock. */
const guideKeys = {
  onSpace: (api: AfterglowStore) => api.toggleGuidePlaying(),
  otherwise: (event: KeyboardEvent, api: AfterglowStore) => {
    if (event.key !== " " || event.repeat) return;
    event.preventDefault();
    api.togglePlaying();
  },
};

const helpStore = { getState: useAfterglow.getState, subscribe: useAfterglow.subscribe };

export function AfterglowOverlay() {
  const t = useTranslations("afterglow");
  const ready = useAfterglow((s) => s.ready);
  const panel = useAfterglow((s) => s.panel);
  const atlas = useAfterglow((s) => s.atlas);
  const selection = useAfterglow((s) => s.selection);
  const guideOpen = useAfterglow((s) => s.guideOpen);
  const guideButton = useGuideFocusReturn(guideOpen);
  const help = useHelp(helpStore, HELP, "afterglow");
  const api = useAfterglow.getState;

  useSceneEscape(escapeSteps);
  useGuideKeys(useAfterglow.getState, guideKeys);

  return (
    <VisualizationOverlay ready={ready}>
      {guideOpen ? (
        <AfterglowGuide />
      ) : (
        <>
          <header className="hud-top pad-hud-top absolute inset-x-0 top-0 z-[60]">
            <div className="flex items-start justify-between gap-3">
              <Readouts />
              <SimulationToolbar
                label={t("hud.controls")}
                help={help}
                details={(access) => <AfterglowTechnicalDetails {...access} />}
                detailsLabel={t("technicalDetails.open")}
                guide={{ onSelect: () => api().startGuide() }}
                guideRef={guideButton}
                tools={[
                  {
                    id: "atlas",
                    label: t("atlas.title"),
                    icon: Map,
                    active: atlas,
                    controls: "afterglow-atlas",
                    onSelect: () => api().setAtlas(!atlas),
                  },
                ]}
                settings={{
                  label: t("hud.settings"),
                  active: panel === "settings",
                  controls: "afterglow-settings",
                  onSelect: () => api().setPanel(panel === "settings" ? "none" : "settings"),
                }}
                drift={() => api().startDrift()}
              />
            </div>
          </header>
          {atlas ? <AtlasPanel onClose={() => api().setAtlas(false)} /> : null}
          {panel === "settings" ? <SettingsPanel onClose={() => api().setPanel("none")} /> : null}
          {!atlas && panel === "none" && selection ? <WorldCard /> : null}
        </>
      )}
      <AfterglowDock />
    </VisualizationOverlay>
  );
}
