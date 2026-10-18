import { useTranslations } from "next-intl";

import { Rail } from "@/components/simulations/rail";
import { SolarObjectPicks } from "@/components/simulations/solar-picks";
import { viewOf } from "@/space/solar-system/model/framing";
import { migrationProgress } from "@/space/solar-system/model/moment";
import type { SolarSelection } from "@/space/solar-system/model/selection";
import { BINS } from "@/space/solar-system/model/tracers";

import { useOrrery } from "../lib/store";

/** Everything to find: picking one flies to the scale it is best seen at and opens its card. */
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
    </Rail>
  );
}
