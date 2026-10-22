"use client";

import { useFormatter, useTranslations } from "next-intl";

import { Rail, RailSection, SwitchGroup } from "@/components/simulations/rail";
import {
  GlowSwitch,
  RenderSection,
  WideColourSwitch,
  type AntialiasMode,
} from "@/components/simulations/render-settings";
import { ControlRow, ListItem, Slider, SwitchRow, kickerClass } from "@horizon/toolkit/ui";

import { ELEMENT_IDS } from "../lib/model/atoms";
import { RESOLUTION_RANGE, WINDOWS } from "../lib/model/scenes";
import { canvasShowsP3, type CanvasAntialias } from "../lib/quality";
import { useSpectroscopy } from "../lib/store";
import { lineName, wavelength } from "./format";
import { useFormedLines, useObservation } from "./use-spectrum";

const PER_ELEMENT = 6;

/** A 2D canvas is always smoothed; SSAA draws the scene at twice the pixels as well. */
const ANTIALIAS_MODES: readonly AntialiasMode<CanvasAntialias>[] = [
  { value: "off", name: "off" },
  { value: "supersample", name: "supersample" },
];

/**
 * Every element: its laboratory pattern to compare, and its strongest lines in view, each a
 * way to select it from the keyboard. An unsolved mystery lists no names.
 */
export function ElementsPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("spectroscopy");
  const f = useFormatter();
  const obs = useObservation();
  const formed = useFormedLines(obs);
  const compare = useSpectroscopy((s) => s.compare);
  const selection = useSpectroscopy((s) => s.selection);
  const view = useSpectroscopy((s) => s.view);
  const checked = useSpectroscopy((s) => s.result !== null);
  const api = useSpectroscopy.getState;
  const identify = view !== "mystery" || checked;
  return (
    <Rail
      id="spectroscopy-elements"
      title={t("hud.elements")}
      closeLabel={t("hud.close")}
      onClose={onClose}
    >
      <p className="text-xs leading-relaxed text-fg-secondary">{t("panel.elementsNote")}</p>
      {ELEMENT_IDS.map((element) => {
        const lines = identify
          ? formed.filter((l) => l.line.element === element).slice(0, PER_ELEMENT)
          : [];
        return (
          <RailSection key={element} title={t(`elements.${element}`)}>
            <SwitchGroup>
              <SwitchRow
                on={compare.includes(element)}
                onToggle={() => api().toggleCompare(element)}
              >
                {t("panel.mark")}
              </SwitchRow>
              {lines.map(({ line, centre }) => (
                <ListItem
                  key={line.id}
                  selected={selection === line.id}
                  onClick={() => {
                    api().select(line.id);
                    api().setPanel("none");
                    const [from, to] = useSpectroscopy.getState().range;
                    if (centre < from || centre > to) api().setRange([centre - 5, centre + 5]);
                  }}
                >
                  <span className="truncate">{lineName(line, f)}</span>
                  <span className="font-mono text-xs text-fg-secondary tabular-nums">
                    {wavelength(f, centre, 2)} nm
                  </span>
                </ListItem>
              ))}
              {identify && lines.length === 0 ? (
                <p className="px-3 py-1 text-xs text-fg-tertiary">{t("panel.none")}</p>
              ) : null}
            </SwitchGroup>
          </RailSection>
        );
      })}
    </Rail>
  );
}

/** How the spectrum is drawn: the spectrograph's resolution, the plot and the scene. */
export function ViewPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("spectroscopy");
  const f = useFormatter();
  const resolution = useSpectroscopy((s) => s.resolution);
  const normalized = useSpectroscopy((s) => s.normalized);
  const photons = useSpectroscopy((s) => s.photons);
  const view = useSpectroscopy((s) => s.view);
  const range = useSpectroscopy((s) => s.range);
  const quality = useSpectroscopy((s) => s.quality);
  const antialias = useSpectroscopy((s) => s.antialias);
  const wideColour = useSpectroscopy((s) => s.wideColour);
  const glow = useSpectroscopy((s) => s.glow);
  const api = useSpectroscopy.getState;
  const [lo, hi] = RESOLUTION_RANGE;
  const toSlider = (R: number) => Math.round((Math.log(R / lo) / Math.log(hi / lo)) * 1000);
  const fromSlider = (v: number) => {
    const R = lo * (hi / lo) ** (v / 1000);
    const step = 10 ** Math.floor(Math.log10(R) - 1);
    return Math.round(R / step) * step;
  };
  const describe = (R: number) =>
    t("panel.resolutionValue", {
      power: f.number(R),
      width: f.number(600 / R, { maximumSignificantDigits: 2 }),
    });
  return (
    <Rail
      id="spectroscopy-view"
      title={t("hud.view")}
      closeLabel={t("hud.close")}
      onClose={onClose}
    >
      <RailSection title={t("hud.show")}>
        <SwitchGroup>
          <SwitchRow on={normalized} onToggle={() => api().setNormalized(!normalized)}>
            {t("panel.normalized")}
          </SwitchRow>
          <SwitchRow on={photons} onToggle={() => api().setPhotons(!photons)}>
            {t("panel.photons")}
          </SwitchRow>
        </SwitchGroup>
      </RailSection>
      <RailSection title={t("panel.spectrograph")} note={t("panel.resolutionNote")}>
        <ControlRow label={t("panel.resolution")} value={describe(resolution)}>
          <Slider
            aria-label={t("panel.resolution")}
            min={0}
            max={1000}
            step={1}
            value={[toSlider(resolution)]}
            valueText={(v) => describe(fromSlider(v))}
            onValueChange={([v]) => api().setResolution(fromSlider(v ?? 0))}
          />
        </ControlRow>
      </RailSection>
      <RailSection title={t("panel.windows")}>
        <SwitchGroup>
          {WINDOWS.map((w) => (
            <ListItem
              key={w.id}
              selected={range[0] === w.range[0] && range[1] === w.range[1]}
              onClick={() => api().setRange(w.range)}
            >
              <span className="truncate">{t(`windows.${w.id}`)}</span>
              <span className={kickerClass}>
                {f.number(w.range[0])}–{f.number(w.range[1])}
              </span>
            </ListItem>
          ))}
        </SwitchGroup>
      </RailSection>
      {view !== "kirchhoff" ? null : (
        <p className="text-xs leading-relaxed text-fg-secondary">{t("panel.benchNote")}</p>
      )}
      <RenderSection<CanvasAntialias>
        quality={quality}
        onQuality={(level) => api().setQuality(level)}
        antialias={antialias}
        modes={ANTIALIAS_MODES}
        onAntialias={(mode) => api().setAntialias(mode)}
        onReset={() => api().resetView()}
      >
        <GlowSwitch on={glow} onToggle={() => api().setGlow(!glow)} />
        <WideColourSwitch
          canvas={canvasShowsP3}
          on={wideColour}
          onToggle={() => api().setWideColour(!wideColour)}
        />
      </RenderSection>
    </Rail>
  );
}
