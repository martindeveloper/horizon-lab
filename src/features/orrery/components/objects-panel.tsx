import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { CameraPad } from "@/components/simulations/camera-pad";
import { Rail, RailSection } from "@/components/simulations/rail";
import { SolarBodyPicks } from "@/components/simulations/solar-picks";
import { SwitchChips } from "@/components/simulations/switch-chips";
import { viewOf } from "@/space/solar-system/model/framing";
import { migrationProgress } from "@/space/solar-system/model/moment";
import type { SolarSelection } from "@/space/solar-system/model/selection";
import { BINS, tallyAt } from "@/space/solar-system/model/tracers";
import { ListItem } from "@horizon/toolkit/ui";

import { useOrrery } from "../lib/store";
import { NAMED_IDS } from "./cards";
import { DISPLAY, EXTRA, Switches } from "./view-controls";

/** Layers, display switches, camera pad and every pickable object. */
export function ObjectsPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("orrery");
  const yearsAgo = useOrrery((s) => s.yearsAgo);
  const show = useOrrery((s) => s.show);
  const patchShow = useOrrery((s) => s.patchShow);
  const tally = useMemo(() => tallyAt(yearsAgo), [yearsAgo]);
  /* Picking from the list flies to the scale the object is best seen at. */
  const pick = (sel: SolarSelection) => {
    const api = useOrrery.getState();
    api.setView(viewOf(sel, migrationProgress(api.yearsAgo)));
    api.select(sel);
    api.setPanel("none");
  };
  return (
    <Rail
      id="orrery-objects"
      title={t("hud.objects")}
      closeLabel={t("hud.close")}
      onClose={onClose}
    >
      <RailSection title={t("layers.title")} note={t("hud.legend")}>
        <SwitchChips
          keys={BINS}
          values={show}
          label={(bin) => t("layers.count", { label: t(`layers.${bin}`), count: tally[bin] })}
          onToggle={(bin) => patchShow({ [bin]: !show[bin] })}
        />
      </RailSection>
      <RailSection title={t("hud.display")}>
        <Switches keys={[...DISPLAY, ...EXTRA]} />
      </RailSection>
      <RailSection title={t("hud.camera")}>
        <CameraPad namespace="orrery" onRotate={(turn) => useOrrery.getState().rotate(turn)} />
      </RailSection>
      <RailSection title={t("hud.bodies")}>
        <SolarBodyPicks namespace="orrery" onPick={pick} />
      </RailSection>
      <RailSection title={t("hud.examples")}>
        <div className="grid gap-1">
          {NAMED_IDS.map((id) => (
            <ListItem key={id} onClick={() => pick({ kind: "named", id })}>
              {t(`names.${id}`)}
            </ListItem>
          ))}
          <ListItem onClick={() => pick({ kind: "population", id: "asteroids" })}>
            {t("names.asteroids")}
          </ListItem>
          {BINS.map((bin) => (
            <ListItem key={bin} onClick={() => pick({ kind: "population", id: bin })}>
              {t(`cards.populations.${bin}.title`)}
            </ListItem>
          ))}
        </div>
      </RailSection>
    </Rail>
  );
}
