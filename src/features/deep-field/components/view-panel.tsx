import { useTranslations } from "next-intl";

import { CameraPad } from "@/components/simulations/camera-pad";
import { DistanceUnitControl } from "@/components/simulations/map-readouts";
import { Rail, RailSection } from "@/components/simulations/rail";
import { RenderSection, SCENE_ANTIALIAS } from "@/components/simulations/render-settings";
import { SwitchChips } from "@/components/simulations/switch-chips";

import { useDeepField, type Show } from "../lib/store";

const SWITCHES: (keyof Show)[] = ["names", "distances", "lightTime", "halo"];

/** How the map is drawn: what it shows, the distance unit, and buttons to turn the camera. */
export function ViewPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("deepField");
  const show = useDeepField((s) => s.show);
  const unit = useDeepField((s) => s.distanceUnit);
  const angles = useDeepField((s) => s.cameraAngles);
  const antialias = useDeepField((s) => s.antialias);
  const quality = useDeepField((s) => s.quality);
  return (
    <Rail id="deep-field-view" title={t("hud.view")} closeLabel={t("hud.close")} onClose={onClose}>
      <RailSection title={t("hud.show")}>
        <SwitchChips
          list
          keys={SWITCHES}
          values={show}
          label={(key) => t(`toggles.${key}`)}
          onToggle={(key) => useDeepField.getState().patchShow({ [key]: !show[key] })}
        />
      </RailSection>
      <RailSection title={t("hud.units")}>
        <DistanceUnitControl
          namespace="deepField"
          value={unit}
          onChange={(next) => useDeepField.getState().setDistanceUnit(next)}
        />
      </RailSection>
      <RailSection title={t("hud.camera")}>
        <CameraPad
          namespace="deepField"
          angles={angles}
          onRotate={(turn) => useDeepField.getState().rotate(turn)}
        />
      </RailSection>
      <RenderSection
        quality={quality}
        onQuality={(level) => useDeepField.getState().setQuality(level)}
        antialias={antialias}
        modes={SCENE_ANTIALIAS}
        onAntialias={(mode) => useDeepField.getState().setAntialias(mode)}
        onReset={() => useDeepField.getState().resetView()}
      />
    </Rail>
  );
}
