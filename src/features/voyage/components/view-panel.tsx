import { useTranslations } from "next-intl";

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

import { useVoyage, type Show } from "../lib/store";

const SWITCHES: (keyof Show)[] = ["instruments", "canopy", "names", "orbits"];

/** How the scene is drawn: what it shows, the distance unit, buttons to turn the ship, rendering. */
export function ViewPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("voyage");
  const show = useVoyage((s) => s.show);
  const unit = useVoyage((s) => s.distanceUnit);
  const angles = useVoyage((s) => s.cameraAngles);
  const antialias = useVoyage((s) => s.antialias);
  const quality = useVoyage((s) => s.quality);
  const bloom = useVoyage((s) => s.bloom);
  const lens = useVoyage((s) => s.lens);
  return (
    <Rail id="voyage-view" title={t("hud.view")} closeLabel={t("hud.close")} onClose={onClose}>
      <RailSection title={t("hud.show")}>
        <SwitchChips
          list
          keys={SWITCHES}
          values={show}
          label={(key) => t(`toggles.${key}`)}
          onToggle={(key) => useVoyage.getState().patchShow({ [key]: !show[key] })}
        />
      </RailSection>
      <RailSection title={t("hud.units")}>
        <DistanceUnitControl
          namespace="voyage"
          value={unit}
          onChange={(next) => useVoyage.getState().setDistanceUnit(next)}
        />
      </RailSection>
      <RailSection title={t("hud.camera")}>
        <CameraPad
          namespace="voyage"
          angles={angles}
          onRotate={(turn) => useVoyage.getState().rotate(turn)}
        />
      </RailSection>
      <RenderSection
        quality={quality}
        onQuality={(level) => useVoyage.getState().setQuality(level)}
        antialias={antialias}
        modes={SCENE_ANTIALIAS}
        onAntialias={(mode) => useVoyage.getState().setAntialias(mode)}
        onReset={() => useVoyage.getState().resetView()}
      >
        <BloomSwitch on={bloom} onToggle={() => useVoyage.getState().setBloom(!bloom)} />
        <LensSwitch on={lens} onToggle={() => useVoyage.getState().setLens(!lens)} />
      </RenderSection>
    </Rail>
  );
}
