"use client";

import { useTranslations } from "next-intl";

import { solarNameKey } from "@/space/solar-system/format";
import type { SolarSelection } from "@/space/solar-system/model/selection";
import type { Bin } from "@/space/solar-system/model/tracers";
import { NAMED, PLANET_IDS } from "@horizon/toolkit/bodies";
import { ListItem } from "@horizon/toolkit/ui";

import { RailSection } from "./rail";

/**
 * The solar system's objects to pick from, in the Objects panel of every simulation: the Sun
 * and planets, the named small worlds, then the belts and clouds this simulation draws (none,
 * for one that draws no belt). Named by the shared space copy in `namespace`.
 */
export function SolarObjectPicks({
  namespace,
  belts,
  onPick,
}: {
  namespace: string;
  belts: readonly ("asteroids" | Bin)[];
  onPick: (sel: SolarSelection) => void;
}) {
  const t = useTranslations(namespace);
  const item = (sel: SolarSelection, key: string) => (
    <ListItem key={key} onClick={() => onPick(sel)}>
      {t(solarNameKey(sel))}
    </ListItem>
  );
  return (
    <>
      <RailSection title={t("hud.bodies")}>
        <div className="grid grid-cols-2 gap-1">
          {item({ kind: "sun" }, "sun")}
          {PLANET_IDS.map((id) => item({ kind: "planet", id }, id))}
        </div>
      </RailSection>
      <RailSection title={t("hud.smallWorlds")}>
        <div className="grid grid-cols-2 gap-1">
          {NAMED.map(({ id }) => item({ kind: "named", id }, id))}
        </div>
      </RailSection>
      {belts.length > 0 ? (
        <RailSection title={t("hud.belts")}>
          <div className="grid gap-1">
            {belts.map((id) => item({ kind: "population", id }, id))}
          </div>
        </RailSection>
      ) : null}
    </>
  );
}
