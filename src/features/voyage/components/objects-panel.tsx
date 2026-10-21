import { useTranslations } from "next-intl";

import { Rail, RailSection } from "@/components/simulations/rail";
import { SolarObjectPicks } from "@/components/simulations/solar-picks";
import type { WorldSelection } from "@/space/galaxy/show";
import { solarNameKey } from "@/space/solar-system/format";
import type { SolarSelection } from "@/space/solar-system/model/selection";
import { MOONS, PLANET_IDS, type BodyId } from "@horizon/toolkit/bodies";
import { ListItem } from "@horizon/toolkit/ui";

import { FAR_ANCHOR_IDS, anchorNameKey, type AnchorId } from "../lib/model/anchors";
import { useVoyage } from "../lib/store";
import { bodyOfSelection } from "./cards";

/** The moons by the planet they orbit, in the planets' order. */
const SYSTEMS = [...PLANET_IDS, "pluto" as const]
  .map((host) => ({ host, moons: MOONS.filter((m) => m.host === host) }))
  .filter(({ moons }) => moons.length > 0);

/** The card a far place opens on arrival: α Centauri's; the rest have none. */
const farSelection = (id: AnchorId): WorldSelection | null =>
  id === "alphaCen" ? { kind: "star", id: "alphaCen" } : null;

/** Everything to fly to: picking one sends the ship there and opens its card. */
export function ObjectsPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("voyage");
  const go = (sel: WorldSelection | null, body: AnchorId) => {
    const api = useVoyage.getState();
    api.goTo(body);
    api.select(sel);
  };
  const pick = (sel: SolarSelection) => {
    const body = bodyOfSelection(sel);
    if (body) go(sel, body);
  };
  const item = (sel: SolarSelection, body: BodyId) => (
    <ListItem key={body} onClick={() => go(sel, body)}>
      {t(solarNameKey(sel))}
    </ListItem>
  );
  return (
    <Rail
      id="voyage-objects"
      title={t("hud.objects")}
      closeLabel={t("hud.close")}
      onClose={onClose}
    >
      <SolarObjectPicks namespace="voyage" belts={[]} onPick={pick} />
      <RailSection title={t("hud.farPlaces")}>
        <div className="grid grid-cols-2 gap-1">
          {FAR_ANCHOR_IDS.map((id) => (
            <ListItem key={id} onClick={() => go(farSelection(id), id)}>
              {t(anchorNameKey(id))}
            </ListItem>
          ))}
        </div>
      </RailSection>
      {SYSTEMS.map(({ host, moons }) => (
        <RailSection
          key={host}
          title={t("hud.moonsOf", {
            body: t(
              solarNameKey(
                host === "pluto" ? { kind: "named", id: host } : { kind: "planet", id: host },
              ),
            ),
          })}
        >
          <div className="grid grid-cols-2 gap-1">
            {moons.map(({ id }) => item({ kind: "moon", id }, id))}
          </div>
        </RailSection>
      ))}
    </Rail>
  );
}
