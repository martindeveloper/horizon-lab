"use client";

import { Crosshair } from "lucide-react";

import { SimulationToolbar } from "@/components/simulations/simulation-toolbar";
import { useGuideFocusReturn } from "@/components/simulations/use-guide-focus-return";
import { useSceneEscape, type EscapeStep } from "@/components/simulations/use-scene-escape";
import { VisualizationOverlay, cn } from "@horizon/toolkit/ui";

import { useGiants } from "../lib/store";
import { RungCard } from "./card";
import { GiantsDock } from "./dock";
import { useGiantsT } from "./format";
import { GiantsGuide } from "./guide";
import { StarsPanel, ViewPanel } from "./panels";
import { GiantsTechnicalDetails } from "./technical-details";

/** Escape ends the guide, else closes the panel, else closes the card. */
const escapeSteps = (): EscapeStep[] => {
  const api = useGiants.getState();
  return [
    [api.guideOpen, api.endGuide],
    [api.panel !== "none", () => api.setPanel("none")],
    [api.card || api.sheet, () => api.setCard(false)],
  ];
};

export function GiantsOverlay() {
  const { t } = useGiantsT();
  const ready = useGiants((s) => s.ready);
  const panel = useGiants((s) => s.panel);
  const card = useGiants((s) => s.card);
  const sheet = useGiants((s) => s.sheet);
  const guideOpen = useGiants((s) => s.guideOpen);
  const guideButton = useGuideFocusReturn(guideOpen);
  const api = useGiants.getState;
  useSceneEscape(escapeSteps);

  return (
    <VisualizationOverlay
      className={cn("transition-opacity duration-500", ready ? "opacity-100" : "opacity-0")}
      inert={!ready}
    >
      {guideOpen ? null : (
        <header className="hud-top pad-hud-top anim-fade absolute inset-x-0 top-0 z-[60]">
          <div className="flex items-start gap-3">
            <p className="line-clamp-2 max-w-sm text-xs text-muted not-md:hidden">
              {t("hud.hint")}
            </p>
            <SimulationToolbar
              label={t("hud.controls")}
              details={(access) => <GiantsTechnicalDetails {...access} />}
              detailsLabel={t("technicalDetails.open")}
              guide={{ onSelect: () => api().startGuide() }}
              guideRef={guideButton}
              finder={{
                id: "stars",
                label: t("hud.stars"),
                icon: Crosshair,
                active: panel === "stars",
                controls: "giants-stars",
                onSelect: () => api().setPanel(panel === "stars" ? "none" : "stars"),
              }}
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
      {/* The card of the body in focus: beside the stage while open, over the dock on phones. */}
      {panel === "none" && (card || sheet) ? (
        <div className={cn(!card && "md:hidden", (!sheet || guideOpen) && "not-md:hidden")}>
          <RungCard />
        </div>
      ) : null}
      {guideOpen ? <GiantsGuide /> : <GiantsDock />}
    </VisualizationOverlay>
  );
}
