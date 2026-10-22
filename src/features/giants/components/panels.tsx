"use client";

import { Rail, RailSection, SwitchGroup } from "@/components/simulations/rail";
import {
  BloomSwitch,
  RenderSection,
  WideColourSwitch,
  type AntialiasMode,
} from "@/components/simulations/render-settings";
import { buildCard } from "@/lib/facts";
import { ListItem, SegmentedControl, SwitchRow, kickerClass } from "@horizon/toolkit/ui";

import { SURFACE_ZOOMS } from "../lib/model/inspection";
import { RULERS } from "../lib/model/ruler";
import { RUNGS, rungIndex } from "../lib/model/rungs";
import type { GiantsAntialias } from "../lib/quality";
import { useGiants } from "../lib/store";
import { RUNG_CARDS } from "./card-specs";
import { useDistance, useGiantsT } from "./format";

const ANTIALIAS_MODES: readonly AntialiasMode<GiantsAntialias>[] = [
  { value: "off", name: "off" },
  { value: "fxaa", name: "fxaa" },
];

/** Every body on the ladder, smallest first, with its size; a pick flies there. */
export function StarsPanel({ onClose }: { onClose: () => void }) {
  const { t } = useGiantsT();
  const distance = useDistance();
  const focus = useGiants((s) => s.focus);
  return (
    <Rail id="giants-stars" title={t("hud.stars")} closeLabel={t("hud.close")} onClose={onClose}>
      <SwitchGroup>
        {RUNGS.map((rung) => {
          const size = buildCard(t, distance, { rows: RUNG_CARDS[rung.id].rows.slice(0, 1) })
            .facts[0]?.value;
          return (
            <ListItem
              key={rung.id}
              selected={rungIndex(rung.id) === focus}
              onClick={() => useGiants.getState().go(rungIndex(rung.id))}
            >
              <span className="truncate">{t(`rungs.${rung.id}.name`)}</span>
              <span className={kickerClass}>{size}</span>
            </ListItem>
          );
        })}
      </SwitchGroup>
    </Rail>
  );
}

/** How the ladder is drawn: the planets' orbits, the ruler's unit, then rendering. */
export function ViewPanel({ onClose }: { onClose: () => void }) {
  const { t } = useGiantsT();
  const orbits = useGiants((s) => s.orbits);
  const ruler = useGiants((s) => s.ruler);
  const surfaceZoom = useGiants((s) => s.surfaceZoom);
  const quality = useGiants((s) => s.quality);
  const antialias = useGiants((s) => s.antialias);
  const bloom = useGiants((s) => s.bloom);
  const focusBlur = useGiants((s) => s.focusBlur);
  const wideColour = useGiants((s) => s.wideColour);
  const api = useGiants.getState;
  return (
    <Rail id="giants-view" title={t("hud.view")} closeLabel={t("hud.close")} onClose={onClose}>
      <RailSection title={t("hud.show")}>
        <SwitchGroup>
          <SwitchRow on={orbits} onToggle={() => api().setOrbits(!orbits)}>
            {t("panel.orbits")}
          </SwitchRow>
        </SwitchGroup>
        <p className="mt-1 text-xs text-muted">{t("panel.orbitsNote")}</p>
      </RailSection>
      <RailSection title={t("panel.ruler")}>
        <SegmentedControl
          aria-label={t("panel.ruler")}
          options={RULERS.map((value) => ({ value, label: t(`panel.rulers.${value}`) }))}
          value={ruler}
          onValueChange={(value) => api().setRuler(value)}
          className="flex-wrap"
        />
      </RailSection>
      <RailSection title={t("panel.surfaceZoom")}>
        <SegmentedControl
          aria-label={t("panel.surfaceZoom")}
          options={SURFACE_ZOOMS.map((value) => ({ value: String(value), label: `${value}×` }))}
          value={String(surfaceZoom)}
          onValueChange={(value) =>
            api().setSurfaceZoom(SURFACE_ZOOMS.find((zoom) => String(zoom) === value) ?? 1)
          }
        />
        <p className="mt-1 text-xs text-muted">{t("panel.surfaceZoomNote")}</p>
      </RailSection>
      <RenderSection<GiantsAntialias>
        quality={quality}
        onQuality={(level) => api().setQuality(level)}
        antialias={antialias}
        modes={ANTIALIAS_MODES}
        onAntialias={(mode) => api().setAntialias(mode)}
        onReset={() => api().resetView()}
        note={<p className="text-xs text-muted">{t("panel.focusBlurNote")}</p>}
      >
        <BloomSwitch on={bloom} onToggle={() => api().setBloom(!bloom)} />
        <SwitchRow on={focusBlur} onToggle={() => api().setFocusBlur(!focusBlur)}>
          {t("panel.focusBlur")}
        </SwitchRow>
        <WideColourSwitch webgl on={wideColour} onToggle={() => api().setWideColour(!wideColour)} />
      </RenderSection>
    </Rail>
  );
}
