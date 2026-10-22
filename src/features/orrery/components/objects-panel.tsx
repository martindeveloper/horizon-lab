import { useTranslations } from "next-intl";

import { Rail, RailSection } from "@/components/simulations/rail";
import { SolarObjectPicks } from "@/components/simulations/solar-picks";
import { viewOf } from "@/space/solar-system/model/framing";
import { migrationProgress } from "@/space/solar-system/model/moment";
import { OBSERVATORY_IDS } from "@/space/solar-system/model/observatories";
import type { SolarSelection } from "@/space/solar-system/model/selection";
import { BINS } from "@/space/solar-system/model/tracers";
import { ListItem } from "@horizon/toolkit/ui";

import { useOrrery } from "../lib/store";

/**
 * Everything to find: picking one flies to the scale it is best seen at and opens its card; an
 * observatory, to Earth's close-up, where its orbit shows.
 */
export function ObjectsPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("orrery");
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
      <SolarObjectPicks namespace="orrery" belts={["asteroids", ...BINS]} onPick={pick} />
      <RailSection title={t("hud.observatories")}>
        <div className="grid grid-cols-2 gap-1">
          {OBSERVATORY_IDS.map((id) => (
            <ListItem
              key={id}
              onClick={() => {
                const api = useOrrery.getState();
                api.findObservatory(id);
                api.setPanel("none");
              }}
            >
              {t(`names.${id}`)}
            </ListItem>
          ))}
        </div>
      </RailSection>
    </Rail>
  );
}
