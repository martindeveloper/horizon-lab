import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { CameraPad } from "@/components/simulations/camera-pad";
import { DistanceUnitControl } from "@/components/simulations/map-readouts";
import { Rail, RailSection } from "@/components/simulations/rail";
import {
  BloomSwitch,
  LensSwitch,
  RenderSection,
  SCENE_ANTIALIAS,
} from "@/components/simulations/render-settings";
import { SwitchChips } from "@/components/simulations/switch-chips";
import { BINS, tallyAt } from "@/space/solar-system/model/tracers";

import { useOrrery } from "../lib/store";
import { DISPLAY, EXTRA, Switches } from "./view-controls";

/** How the map is drawn: its layers, what it shows, the distance unit, and buttons to turn the camera. */
export function ViewPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("orrery");
  const yearsAgo = useOrrery((s) => s.yearsAgo);
  const show = useOrrery((s) => s.show);
  const patchShow = useOrrery((s) => s.patchShow);
  const unit = useOrrery((s) => s.distanceUnit);
  const angles = useOrrery((s) => s.cameraAngles);
  const antialias = useOrrery((s) => s.antialias);
  const quality = useOrrery((s) => s.quality);
  const bloom = useOrrery((s) => s.bloom);
  const lens = useOrrery((s) => s.lens);
  const tally = useMemo(() => tallyAt(yearsAgo), [yearsAgo]);
  return (
    <Rail id="orrery-view" title={t("hud.view")} closeLabel={t("hud.close")} onClose={onClose}>
      <RailSection title={t("hud.show")}>
        <Switches list keys={[...DISPLAY, ...EXTRA]} />
      </RailSection>
      <RailSection title={t("layers.title")} note={t("hud.legend")}>
        <SwitchChips
          list
          keys={BINS}
          values={show}
          label={(bin) => t("layers.count", { label: t(`layers.${bin}`), count: tally[bin] })}
          onToggle={(bin) => patchShow({ [bin]: !show[bin] })}
        />
      </RailSection>
      <RailSection title={t("hud.units")}>
        <DistanceUnitControl
          namespace="orrery"
          value={unit}
          onChange={(next) => useOrrery.getState().setDistanceUnit(next)}
        />
      </RailSection>
      <RailSection title={t("hud.camera")}>
        <CameraPad
          namespace="orrery"
          angles={angles}
          onRotate={(turn) => useOrrery.getState().rotate(turn)}
        />
      </RailSection>
      <RenderSection
        quality={quality}
        onQuality={(level) => useOrrery.getState().setQuality(level)}
        antialias={antialias}
        modes={SCENE_ANTIALIAS}
        onAntialias={(mode) => useOrrery.getState().setAntialias(mode)}
        onReset={() => useOrrery.getState().resetView()}
      >
        <BloomSwitch on={bloom} onToggle={() => useOrrery.getState().setBloom(!bloom)} />
        <LensSwitch on={lens} onToggle={() => useOrrery.getState().setLens(!lens)} />
      </RenderSection>
    </Rail>
  );
}
