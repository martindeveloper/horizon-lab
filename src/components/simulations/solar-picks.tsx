"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { solarNameKey } from "@/space/solar-system/format";
import type { SolarSelection } from "@/space/solar-system/model/selection";
import type { Bin } from "@/space/solar-system/model/tracers";
import { NAMED, PLANET_IDS } from "@horizon/toolkit/bodies";
import { ListItem, Orb } from "@horizon/toolkit/ui";

import { BodyOrb } from "./body-orb";
import { RailSection } from "./rail";

/** A region of the simulation's own beyond the belts (the heliopause): its name's key and what picking it does. */
export type EdgePick = { key: string; name: string; onPick: () => void };

/**
 * The solar system's objects to pick from, in the Objects panel of every simulation: the Sun
 * and planets, the named small worlds, then the belts and clouds this simulation draws (none,
 * for one that draws no belt) and the edges it adds to them (`edges`). Named by the shared
 * space copy in `namespace`.
 */
export function SolarObjectPicks({
  namespace,
  belts,
  edges = [],
  onPick,
}: {
  namespace: string;
  belts: readonly ("asteroids" | Bin)[];
  edges?: readonly EdgePick[];
  onPick: (sel: SolarSelection) => void;
}) {
  const t = useTranslations(namespace);
  const item = (sel: SolarSelection, key: string, icon: ReactNode) => (
    <ListItem key={key} icon={icon} onClick={() => onPick(sel)}>
      {t(solarNameKey(sel))}
    </ListItem>
  );
  return (
    <>
      <RailSection title={t("hud.bodies")} count={PLANET_IDS.length + 1}>
        <div className="-mx-3 grid grid-cols-2 gap-0.5">
          {item({ kind: "sun" }, "sun", <BodyOrb id="sun" />)}
          {PLANET_IDS.map((id) => item({ kind: "planet", id }, id, <BodyOrb id={id} />))}
        </div>
      </RailSection>
      <RailSection title={t("hud.smallWorlds")} count={NAMED.length}>
        <div className="-mx-3 grid grid-cols-2 gap-0.5">
          {NAMED.map(({ id }) => item({ kind: "named", id }, id, <BodyOrb id={id} />))}
        </div>
      </RailSection>
      {belts.length + edges.length > 0 ? (
        <RailSection
          title={t(edges.length > 0 ? "hud.regions" : "hud.belts")}
          count={belts.length + edges.length}
        >
          <div className="-mx-3 grid gap-0.5">
            {belts.map((id) => item({ kind: "population", id }, id, <Orb look="swarm" />))}
            {edges.map(({ key, name, onPick: pick }) => (
              <ListItem key={key} icon={<Orb look="swarm" />} onClick={pick}>
                {t(name)}
              </ListItem>
            ))}
          </div>
        </RailSection>
      ) : null}
    </>
  );
}
