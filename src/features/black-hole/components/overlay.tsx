import { Crosshair, Timer } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, type ReactNode } from "react";

import { useHelp } from "@/components/simulations/help-tour";
import { Rail, RailSection } from "@/components/simulations/rail";
import { SimulationToolbar } from "@/components/simulations/simulation-toolbar";
import { useDockClearance, type DockInTheWay } from "@/components/simulations/use-dock-clearance";
import { useSceneEscape, type EscapeStep } from "@/components/simulations/use-scene-escape";
import { HeaderRow } from "@/components/simulations/view-picker";
import {
  DataReadout,
  Dock,
  Kicker,
  VisualizationOverlay,
  cn,
  useFocusHandoff,
} from "@horizon/toolkit/ui";

import { HELP } from "../lib/help";
import { PRESETS } from "../lib/holes";
import {
  horizonOverM,
  iscoOverM,
  iscoPeriodSeconds,
  photonOverM,
  schwarzschildKm,
} from "../lib/physics";
import { useBlackHole } from "../lib/store";
import { AtlasOverlay } from "./atlas";
import { ClockDrops } from "./clocks";
import { GuideOverlay } from "./guide";
import { Hotspots } from "./hotspots";
import { StoryLine } from "./learn";
import { PinLesson } from "./pin-lessons";
import { HolePicker } from "./preset-nav";
import { SETTINGS_PANEL_ID, SettingsBody } from "./settings";
import { BlackHoleTechnicalDetails } from "./technical-details";
import { usePhysicsFormat } from "./use-physics-format";

function Readout() {
  const { formatMassShort, formatLengthKm, formatDuration, formatNumber } = usePhysicsFormat();
  const t = useTranslations("blackHole");
  const massSolar = useBlackHole((s) => s.massSolar);
  const spin = useBlackHole((s) => s.spin);
  const presetId = useBlackHole((s) => s.presetId);
  const preset = PRESETS.find((p) => p.id === presetId);
  const lowerLimit = preset?.massLowerLimit;
  const massLabel = preset?.massNote === "bound" ? t("massBound") : t("mass");
  const rs = schwarzschildKm(massSolar);
  const rh = horizonOverM(spin);
  const rp = photonOverM(spin);
  const ri = iscoOverM(spin);
  const period = iscoPeriodSeconds(massSolar, spin);

  const cells = [
    { k: massLabel, v: `${lowerLimit ? "≥ " : ""}${formatMassShort(massSolar)}` },
    { k: "Rs", v: formatLengthKm(rs) },
    { k: t("horizon"), v: `${formatNumber(rh, 2)} M` },
    { k: t("photon"), v: `${formatNumber(rp, 2)} M` },
    { k: t("isco"), v: `${formatNumber(ri, 2)} M` },
    { k: t("period"), v: formatDuration(period) },
  ];

  return (
    <DataReadout
      items={cells.map((cell) => ({
        id: cell.k,
        label: cell.k,
        value: cell.v,
      }))}
    />
  );
}

/** Real objects whose flow the thin-disk renderer cannot model say so at a glance. */
function FlowNotice({ className }: { className?: string }) {
  const t = useTranslations("blackHole");
  const flow = useBlackHole((s) => PRESETS.find((p) => p.id === s.presetId)?.illustrativeFlow);
  return flow ? (
    <p className={cn("text-ui text-fg-tertiary", className)}>{t("flowNotice")}</p>
  ) : null;
}

/** The story dock on wide screens; the settings rail ends above it where they would meet. */
const reachesRail: DockInTheWay = (dock, stage, rem) => dock.right + 22 * rem > stage.right;

function StoryDock() {
  const dock = useRef<HTMLDivElement>(null);
  useDockClearance(dock, reachesRail);
  return (
    <Dock ref={dock} footerClassName="hidden md:block" className="flex items-center gap-8">
      <div className="min-w-0 flex-1">
        <StoryLine />
        <FlowNotice className="mt-1.5" />
      </div>
      <div className="hidden w-[22rem] shrink-0 border-l border-border pl-6 lg:block">
        <Readout />
      </div>
    </Dock>
  );
}

/** Escape ends the guide, else closes the atlas, the clocks or the settings, in that order. */
const escapeSteps = (): EscapeStep[] => {
  const s = useBlackHole.getState();
  return [
    [s.guideOpen, s.endGuide],
    [s.mapOpen, () => s.setMapOpen(false)],
    [s.clocksOpen, () => s.setClocksOpen(false)],
    [s.settingsOpen, () => s.setSettingsOpen(false)],
  ];
};

const helpStore = { getState: useBlackHole.getState, subscribe: useBlackHole.subscribe };

export function ObservatoryOverlay() {
  const { formatMassShort } = usePhysicsFormat();
  const t = useTranslations("blackHole");
  const presetId = useBlackHole((s) => s.presetId);
  const settingsOpen = useBlackHole((s) => s.settingsOpen);
  const setSettingsOpen = useBlackHole((s) => s.setSettingsOpen);
  const active = PRESETS.find((p) => p.id === presetId);
  const skyReady = useBlackHole((s) => s.skyReady);
  const activePin = useBlackHole((s) => s.activePin);
  const guideOpen = useBlackHole((s) => s.guideOpen);
  const mapOpen = useBlackHole((s) => s.mapOpen);
  const setMapOpen = useBlackHole((s) => s.setMapOpen);
  const clocksOpen = useBlackHole((s) => s.clocksOpen);
  const setClocksOpen = useBlackHole((s) => s.setClocksOpen);
  const startGuide = useBlackHole((s) => s.startGuide);
  const spin = useBlackHole((s) => s.spin);
  const massSolar = useBlackHole((s) => s.massSolar);
  const setActivePin = useBlackHole((s) => s.setActivePin);
  const holeName = t.has(`presets.${presetId}`) ? t(`presets.${presetId}`) : t("custom");
  const help = useHelp(helpStore, HELP, "blackHole");

  useSceneEscape(escapeSteps);

  function toggleMenu() {
    const next = !useBlackHole.getState().settingsOpen;
    setSettingsOpen(next);
    if (next) setActivePin(null);
  }

  return (
    <VisualizationOverlay ready={skyReady}>
      {guideOpen ? <GuideOverlay /> : null}
      {mapOpen ? <AtlasOverlay /> : null}
      {guideOpen || mapOpen ? <h1 className="sr-only">{holeName}</h1> : null}

      {!guideOpen && !mapOpen ? (
        <>
          <header className="hud-top pad-hud-top absolute inset-x-0 top-0 z-[60]">
            <HeaderRow>
              {/* The picker shows the name. */}
              <h1 className="sr-only">{holeName}</h1>
              <HolePicker />
              <SimulationToolbar
                label={t("controls")}
                help={help}
                details={(access) => <BlackHoleTechnicalDetails {...access} />}
                detailsLabel={t("technicalDetails.open")}
                guide={{ onSelect: startGuide }}
                finder={{
                  id: "atlas",
                  label: t("atlas"),
                  ariaLabel: t("ariaOpenAtlas"),
                  icon: Crosshair,
                  onSelect: () => setMapOpen(true),
                }}
                tools={[
                  {
                    id: "clocks",
                    label: clocksOpen ? t("close") : t("clocks"),
                    menuLabel: t("clocks"),
                    ariaLabel: clocksOpen ? t("ariaCloseClocks") : t("ariaDropClocks"),
                    icon: Timer,
                    active: clocksOpen,
                    onSelect: () => setClocksOpen(!clocksOpen),
                  },
                ]}
                settings={{
                  label: t("view"),
                  active: settingsOpen,
                  controls: SETTINGS_PANEL_ID,
                  onSelect: toggleMenu,
                }}
                drift={() => useBlackHole.getState().startDrift()}
              />
            </HeaderRow>
          </header>

          {settingsOpen ? (
            <Rail
              id={SETTINGS_PANEL_ID}
              title={t("view")}
              closeLabel={t("close")}
              onClose={() => setSettingsOpen(false)}
              sheetLead={
                <>
                  {/* Phones read the hole's story here; wide screens have it in the dock. */}
                  <RailSection title={t("story")}>
                    <StoryLine alwaysOpen />
                  </RailSection>
                  <RailSection title={t("measurements")}>
                    <Readout />
                  </RailSection>
                </>
              }
            >
              <SettingsBody />
            </Rail>
          ) : null}

          {!activePin && !clocksOpen ? <StoryDock /> : null}

          {!activePin && !settingsOpen && !clocksOpen ? (
            <Dock footerClassName="md:hidden" className="overflow-hidden">
              <Kicker className="mb-1.5 text-caption">
                {active ? t(`presets.${active.id}`) : t("custom")}
                <span className="text-fg-tertiary">
                  {" "}
                  ·{" "}
                  {active
                    ? active.kind === "catalog"
                      ? t("kindCatalog")
                      : t("kindTheory")
                    : t("custom")}{" "}
                  · {active?.massLowerLimit ? "≥ " : ""}
                  {formatMassShort(massSolar)}
                </span>
              </Kicker>
              <FlowNotice className="mb-1" />
              <StoryLine />
            </Dock>
          ) : null}

          {/* On phones a pin's card takes the gauge's place, for a tour too. */}
          {activePin ? (
            <div
              data-coach="gauge"
              className="pad-sheet pointer-events-auto absolute inset-x-0 bottom-0 z-50 md:hidden"
            >
              <MobilePinCard>
                <PinLesson id={activePin} spin={spin} onClose={() => setActivePin(null)} />
              </MobilePinCard>
            </div>
          ) : null}
        </>
      ) : null}

      {/* After the header in reading and tab order; z-index keeps them visually beneath. */}
      <Hotspots />
      <ClockDrops />
    </VisualizationOverlay>
  );
}

/** The phone pin card takes focus when it opens and hands it back when it closes. */
function MobilePinCard({ children }: { children: ReactNode }) {
  const card = useRef<HTMLDivElement>(null);
  useFocusHandoff(card);
  return (
    <div
      ref={card}
      tabIndex={-1}
      className="pin-card-mobile lesson-card no-scrollbar anim-sheet overflow-x-hidden overflow-y-auto rounded-t-card p-panel-compact outline-hidden"
    >
      {children}
    </div>
  );
}
