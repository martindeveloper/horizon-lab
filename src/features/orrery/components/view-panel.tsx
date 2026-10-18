import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { CameraPad } from "@/components/simulations/camera-pad";
import { Rail, RailSection } from "@/components/simulations/rail";
import { SwitchChips } from "@/components/simulations/switch-chips";
import { BINS, tallyAt } from "@/space/solar-system/model/tracers";

import { useOrrery } from "../lib/store";
import { DISPLAY, EXTRA, Switches } from "./view-controls";

/** How the map is drawn: its layers, what it shows, and buttons to turn the camera. */
export function ViewPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("orrery");
  const yearsAgo = useOrrery((s) => s.yearsAgo);
  const show = useOrrery((s) => s.show);
  const patchShow = useOrrery((s) => s.patchShow);
  const tally = useMemo(() => tallyAt(yearsAgo), [yearsAgo]);
  return (
    <Rail id="orrery-view" title={t("hud.view")} closeLabel={t("hud.close")} onClose={onClose}>
      <RailSection title={t("layers.title")} note={t("hud.legend")}>
        <SwitchChips
          list
          keys={BINS}
          values={show}
          label={(bin) => t("layers.count", { label: t(`layers.${bin}`), count: tally[bin] })}
          onToggle={(bin) => patchShow({ [bin]: !show[bin] })}
        />
      </RailSection>
      <RailSection title={t("hud.show")}>
        <Switches list keys={[...DISPLAY, ...EXTRA]} />
      </RailSection>
      <RailSection title={t("hud.camera")}>
        <CameraPad namespace="orrery" onRotate={(turn) => useOrrery.getState().rotate(turn)} />
      </RailSection>
    </Rail>
  );
}
