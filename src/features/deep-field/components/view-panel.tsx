import { useTranslations } from "next-intl";

import { CameraPad } from "@/components/simulations/camera-pad";
import { DistanceUnitControl } from "@/components/simulations/map-readouts";
import { Rail, RailSection } from "@/components/simulations/rail";
import { SwitchChips } from "@/components/simulations/switch-chips";

import { useDeepField, type Show } from "../lib/store";

const SWITCHES: (keyof Show)[] = ["names", "distances", "lightTime", "halo"];

/** How the map is drawn: what it shows, the distance unit, and buttons to turn the camera. */
export function ViewPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("deepField");
  const show = useDeepField((s) => s.show);
  const unit = useDeepField((s) => s.distanceUnit);
  return (
    <Rail id="deep-field-view" title={t("hud.view")} closeLabel={t("hud.close")} onClose={onClose}>
      <RailSection title={t("hud.show")}>
        <SwitchChips
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
          onRotate={(turn) => useDeepField.getState().rotate(turn)}
        />
      </RailSection>
    </Rail>
  );
}
