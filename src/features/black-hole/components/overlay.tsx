import { Globe2, Orbit, SlidersHorizontal, Timer, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { SimulationImmersiveToggle } from "@/components/simulations/immersive";
import { AtlasOverlay } from "@/features/black-hole/components/atlas";
import { ClockDrops } from "@/features/black-hole/components/clocks";
import { GuideOverlay } from "@/features/black-hole/components/guide";
import { Hotspots } from "@/features/black-hole/components/hotspots";
import { StoryLine } from "@/features/black-hole/components/learn";
import { usePhysicsFormat } from "@/features/black-hole/hooks/use-physics-format";
import {
  horizonOverM,
  iscoOverM,
  iscoPeriodSeconds,
  photonOverM,
  schwarzschildKm,
} from "@/features/black-hole/lib/physics";
import { PRESETS } from "@/features/black-hole/lib/presets";
import { useBlackHole } from "@/features/black-hole/lib/store";
import {
  DataReadout,
  Dock,
  IconButton,
  Kicker,
  Sheet,
  Toolbar,
  Tooltip,
  VisualizationOverlay,
  cn,
  isSceneShortcut,
  useFocusHandoff,
} from "@horizon/toolkit/ui";

import { PinLesson } from "./pin-lessons";
import { HolePicker, PresetNav } from "./preset-nav";
import { SettingsBody } from "./settings";
import { BlackHoleTechnicalDetails } from "./technical-details";

function Readout() {
  const { formatMassShort, formatLengthKm, formatDuration } = usePhysicsFormat();
  const t = useTranslations("blackHole");
  const massSolar = useBlackHole((s) => s.massSolar);
  const spin = useBlackHole((s) => s.spin);
  const presetId = useBlackHole((s) => s.presetId);
  const preset = PRESETS.find((p) => p.id === presetId);
  const lowerLimit = preset?.massLowerLimit;
  const massLabel =
    preset?.massNote === "bound"
      ? t("massBound")
      : preset?.massNote === "adopted"
        ? t("massAdopted")
        : t("mass");
  const rs = schwarzschildKm(massSolar);
  const rh = horizonOverM(spin);
  const rp = photonOverM(spin);
  const ri = iscoOverM(spin);
  const period = iscoPeriodSeconds(massSolar, spin);

  const cells = [
    { k: massLabel, v: `${lowerLimit ? "≥ " : ""}${formatMassShort(massSolar)}` },
    { k: "Rs", v: formatLengthKm(rs) },
    { k: t("horizon"), v: `${rh.toFixed(2)} M` },
    { k: t("photon"), v: `${rp.toFixed(2)} M` },
    { k: t("isco"), v: `${ri.toFixed(2)} M` },
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
  return flow ? <p className={cn("text-xs text-subtle", className)}>{t("flowNotice")}</p> : null;
}

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !isSceneShortcut(e, { controls: true })) return;
      const s = useBlackHole.getState();
      if (s.guideOpen) {
        s.endGuide();
        return;
      }
      if (s.mapOpen) {
        s.setMapOpen(false);
        return;
      }
      if (s.clocksOpen) {
        s.setClocksOpen(false);
        return;
      }
      if (s.settingsOpen) s.setSettingsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggleMenu() {
    const next = !useBlackHole.getState().settingsOpen;
    setSettingsOpen(next);
    if (next) setActivePin(null);
  }

  return (
    <VisualizationOverlay
      className={cn("transition-opacity duration-500", skyReady ? "opacity-100" : "opacity-0")}
      inert={!skyReady}
    >
      {guideOpen ? <GuideOverlay /> : null}
      {mapOpen ? <AtlasOverlay /> : null}
      {guideOpen || mapOpen ? <h1 className="sr-only">{holeName}</h1> : null}

      {!guideOpen && !mapOpen ? (
        <>
          <header className="hud-top pad-hud-top absolute inset-x-0 top-0 z-[60] pb-8 md:pb-14">
            <div className="flex items-center gap-3">
              {/* The picker (desktop) and the dock kicker (phones) show the name. */}
              <h1 className="sr-only">{holeName}</h1>
              <HolePicker />
              <Toolbar aria-label={t("controls")} className="ml-auto shrink-0">
                <BlackHoleTechnicalDetails />
                <Tooltip label={t("guide")}>
                  <IconButton
                    type="button"
                    data-return="guide"
                    onClick={startGuide}
                    aria-label={t("ariaStartGuide")}
                  >
                    <Orbit className="size-4 md:size-3.5" />
                  </IconButton>
                </Tooltip>
                <Tooltip label={t("atlas")}>
                  <IconButton
                    type="button"
                    data-return="atlas"
                    onClick={() => setMapOpen(true)}
                    aria-label={t("ariaOpenAtlas")}
                  >
                    <Globe2 className="size-4 md:size-3.5" />
                  </IconButton>
                </Tooltip>
                <SimulationImmersiveToggle />
                <Tooltip label={clocksOpen ? t("close") : t("clocks")}>
                  <IconButton
                    type="button"
                    onClick={() => setClocksOpen(!clocksOpen)}
                    data-return="clocks"
                    active={clocksOpen}
                    aria-label={clocksOpen ? t("ariaCloseClocks") : t("ariaDropClocks")}
                  >
                    <Timer className="size-4 md:size-3.5" />
                  </IconButton>
                </Tooltip>
                <Tooltip label={settingsOpen ? t("close") : t("observatory")} align="end">
                  <IconButton
                    type="button"
                    onClick={toggleMenu}
                    active={settingsOpen}
                    aria-label={settingsOpen ? t("ariaCloseObs") : t("ariaOpenObs")}
                    aria-expanded={settingsOpen}
                    aria-controls="observatory-panel observatory-sheet"
                  >
                    {/* Sliders on phones too: the header's menu is the only one. */}
                    {settingsOpen ? (
                      <X className="size-4 md:size-3.5" />
                    ) : (
                      <SlidersHorizontal className="size-4 md:size-3.5" />
                    )}
                  </IconButton>
                </Tooltip>
              </Toolbar>
            </div>
          </header>

          {settingsOpen ? (
            <aside
              id="observatory-panel"
              className="glass-panel anim-rail pointer-events-auto absolute top-0 right-0 bottom-0 z-40 hidden w-56 p-4 pt-16 md:block"
              aria-label={t("controls")}
            >
              <SettingsBody />
            </aside>
          ) : null}

          {!activePin && !clocksOpen ? (
            <Dock
              footerClassName={cn("hidden md:block", settingsOpen && "pr-60")}
              className="flex items-center gap-8"
            >
              <div className="min-w-0 flex-1">
                <StoryLine />
                <FlowNotice className="mt-1.5" />
              </div>
              <div className="hidden w-[22rem] shrink-0 border-l border-border pl-6 lg:block">
                <Readout />
              </div>
            </Dock>
          ) : null}

          {!activePin && !settingsOpen && !clocksOpen ? (
            <Dock footerClassName="md:hidden" className="overflow-hidden">
              <Kicker className="mb-1.5 text-[11px]">
                {active ? (t(`presets.${active.id}`) ?? active.name) : t("custom")}
                <span className="text-subtle">
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

          {activePin ? (
            <div className="pad-sheet pointer-events-auto absolute inset-x-0 bottom-0 z-50 md:hidden">
              <MobilePinCard>
                <PinLesson id={activePin} spin={spin} onClose={() => setActivePin(null)} />
              </MobilePinCard>
            </div>
          ) : null}

          {settingsOpen ? (
            <Sheet
              id="observatory-sheet"
              className="md:hidden"
              panelClassName="observatory-sheet"
              aria-label={t("observatory")}
              dismissLabel={t("dismissObservatory")}
              onDismiss={() => setSettingsOpen(false)}
            >
              <Kicker className="py-2.5">{t("holes")}</Kicker>
              <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    startGuide();
                  }}
                  className="glass-hud mb-3 flex h-11 w-full items-center justify-center gap-2 rounded-full text-xs tracking-widest text-fg uppercase"
                >
                  <Orbit className="size-3.5" />
                  {t("startGuide")}
                </button>
                <PresetNav stacked />
                <Kicker className="mt-5 mb-2">{t("story")}</Kicker>
                <StoryLine alwaysOpen />
                <Kicker className="mt-5 mb-2">{t("measurements")}</Kicker>
                <Readout />
                <Kicker className="mt-5 mb-2">{t("optics")}</Kicker>
                <SettingsBody />
              </div>
            </Sheet>
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
function MobilePinCard({ children }: { children: React.ReactNode }) {
  const card = useRef<HTMLDivElement>(null);
  useFocusHandoff(card);
  return (
    <div
      ref={card}
      tabIndex={-1}
      className="pin-card-mobile lesson-card no-scrollbar anim-sheet overflow-y-auto rounded-t-xl p-3.5 outline-hidden"
    >
      {children}
    </div>
  );
}
