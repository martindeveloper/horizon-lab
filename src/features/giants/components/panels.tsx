"use client";

import { BodyOrb } from "@/components/simulations/body-orb";
import { Rail, RailSection, SwitchGroup } from "@/components/simulations/rail";
import {
  BloomSwitch,
  RenderSection,
  WideColourSwitch,
  type AntialiasMode,
} from "@/components/simulations/render-settings";
import { buildCard } from "@/lib/facts";
import { PLANET_IDS } from "@horizon/toolkit/bodies";
import { includesId } from "@horizon/toolkit/records";
import { ListItem, ListTrack, Orb, SegmentedControl, SwitchRow } from "@horizon/toolkit/ui";

import { SURFACE_ZOOMS } from "../lib/model/inspection";
import { rungNameKey } from "../lib/model/names";
import { RULERS } from "../lib/model/ruler";
import type { GiantsAntialias } from "../lib/quality";
import { useGiants } from "../lib/store";
import { RUNG_CARDS } from "./card-specs";
import { useDistance, useGiantsT } from "./format";
import { LADDER_DOTS, dotPx } from "./ladder-dots";

const ANTIALIAS_MODES: readonly AntialiasMode<GiantsAntialias>[] = [
  { value: "off", name: "off" },
  { value: "fxaa", name: "fxaa" },
];

/** A list dot's diameter, px, from the smallest body's to the largest's. */
const DOT_PX = [4, 16] as const;

/** A rung's mark: a star in its light, a planet in its map's colour, a horizon black. */
function RungOrb({ dot }: { dot: (typeof LADDER_DOTS)[number] }) {
  const size = dotPx(dot.share, DOT_PX);
  if (dot.kind === "horizon") return <Orb look="hole" size={size} />;
  if (includesId(PLANET_IDS, dot.id)) return <BodyOrb id={dot.id} size={size} />;
  return <Orb look="glow" color={dot.colour} size={size} />;
}

/** Every body on the ladder as a route, smallest first, each to scale with its size; a pick flies there. */
export function StarsPanel({ onClose }: { onClose: () => void }) {
  const { t } = useGiantsT();
  const distance = useDistance();
  const focus = useGiants((s) => s.focus);
  return (
    <Rail id="giants-stars" title={t("hud.stars")} closeLabel={t("hud.close")} onClose={onClose}>
      <ListTrack className="-mx-3">
        {LADDER_DOTS.map((dot, index) => (
          <ListItem
            key={dot.id}
            icon={<RungOrb dot={dot} />}
            detail={
              buildCard(t, distance, { rows: RUNG_CARDS[dot.id].rows.slice(0, 1) }).facts[0]?.value
            }
            selected={index === focus}
            onClick={() => useGiants.getState().go(index)}
          >
            {t(rungNameKey(dot.id))}
          </ListItem>
        ))}
      </ListTrack>
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
        <p className="mt-1 text-ui text-fg-secondary">{t("panel.orbitsNote")}</p>
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
        <p className="mt-1 text-ui text-fg-secondary">{t("panel.surfaceZoomNote")}</p>
      </RailSection>
      <RenderSection<GiantsAntialias>
        quality={quality}
        onQuality={(level) => api().setQuality(level)}
        antialias={antialias}
        modes={ANTIALIAS_MODES}
        onAntialias={(mode) => api().setAntialias(mode)}
        onReset={() => api().resetView()}
        note={<p className="text-ui text-fg-secondary">{t("panel.focusBlurNote")}</p>}
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
