"use client";

import { Crosshair, ZoomOut } from "lucide-react";

import { useHelp } from "@/components/simulations/help-tour";
import { SimulationToolbar } from "@/components/simulations/simulation-toolbar";
import { useGuideFocusReturn } from "@/components/simulations/use-guide-focus-return";
import { useSceneEscape, type EscapeStep } from "@/components/simulations/use-scene-escape";
import { VisualizationOverlay, cn } from "@horizon/toolkit/ui";

import { HELP } from "../lib/help";
import { useGiants } from "../lib/store";
import { RungCard } from "./card";
import { GiantsDock } from "./dock";
import { useGiantsT } from "./format";
import { GiantsGuide } from "./guide";
import { StarsPanel, ViewPanel } from "./panels";
import { GiantsTechnicalDetails } from "./technical-details";

/**
 * Escape ends the guide, else closes the panel, else leaves the overview or side by side, else
 * closes the card.
 */
const escapeSteps = (): EscapeStep[] => {
  const api = useGiants.getState();
  return [
    [api.guideOpen, api.endGuide],
    [api.panel !== "none", () => api.setPanel("none")],
    [api.overview, () => api.setOverview(false)],
    [api.sideBySide, () => api.setSideBySide(false)],
    [api.card || api.sheet, () => api.setCard(false)],
  ];
};

const helpStore = { getState: useGiants.getState, subscribe: useGiants.subscribe };

export function GiantsOverlay() {
  const { t } = useGiantsT();
  const ready = useGiants((s) => s.ready);
  const panel = useGiants((s) => s.panel);
  const card = useGiants((s) => s.card);
  const sheet = useGiants((s) => s.sheet);
  const overview = useGiants((s) => s.overview);
  const guideOpen = useGiants((s) => s.guideOpen);
  const guideButton = useGuideFocusReturn(guideOpen);
  const help = useHelp(helpStore, HELP, "giants");
  const api = useGiants.getState;
  useSceneEscape(escapeSteps);

  return (
    <VisualizationOverlay ready={ready}>
      {guideOpen ? null : (
        <header className="hud-top pad-hud-top absolute inset-x-0 top-0 z-[60] anim-fade">
          <div className="flex items-start gap-3">
            <SimulationToolbar
              label={t("hud.controls")}
              help={help}
              details={(access) => <GiantsTechnicalDetails {...access} />}
              detailsLabel={t("technicalDetails.open")}
              guide={{ onSelect: () => api().startGuide() }}
              drift={() => api().startDrift()}
              guideRef={guideButton}
              finder={{
                id: "stars",
                label: t("hud.stars"),
                icon: Crosshair,
                active: panel === "stars",
                controls: "giants-stars",
                onSelect: () => api().setPanel(panel === "stars" ? "none" : "stars"),
              }}
              tools={[
                {
                  id: "overview",
                  label: t("hud.overview"),
                  icon: ZoomOut,
                  active: overview,
                  onSelect: () => api().setOverview(!overview),
                },
              ]}
              settings={{
                label: t("hud.view"),
                active: panel === "view",
                controls: "giants-view",
                onSelect: () => api().setPanel(panel === "view" ? "none" : "view"),
              }}
            />
          </div>
        </header>
      )}
      {!guideOpen && panel === "stars" ? (
        <StarsPanel onClose={() => api().setPanel("none")} />
      ) : null}
      {!guideOpen && panel === "view" ? <ViewPanel onClose={() => api().setPanel("none")} /> : null}
      {/* The card of the body in focus: beside the stage while open, over the dock on phones;
          the overview needs the whole stage, so it waits there until the visitor goes back down. */}
      {panel === "none" && !overview && (card || sheet) ? (
        <div className={cn(!card && "md:hidden", (!sheet || guideOpen) && "not-md:hidden")}>
          <RungCard />
        </div>
      ) : null}
      {guideOpen ? <GiantsGuide /> : <GiantsDock />}
    </VisualizationOverlay>
  );
}
