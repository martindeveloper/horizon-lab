import { useFormatter, useLocale, useTranslations } from "next-intl";

import { Rail, RailSection } from "@/components/simulations/rail";
import { solarNameKey } from "@/space/solar-system/format";
import { MOONS, PLANET_IDS } from "@horizon/toolkit/bodies";
import { ListItem } from "@horizon/toolkit/ui";

import {
  GALAXY_ANCHOR_IDS,
  PROBE_ANCHOR_IDS,
  STAR_ANCHOR_IDS,
  anchorNameKey,
  selectionOfAnchor,
  type AnchorId,
} from "../lib/model/anchors";
import { courseOf, useVoyage } from "../lib/store";
import { DriveControl } from "./flight-dock";
import { NONE, formatTrip } from "./format";
import { momentOf, tripTo } from "./trips";

const HOME: readonly AnchorId[] = ["moon", "earth", "sun"];
const PLANETS: readonly AnchorId[] = [...PLANET_IDS, "pluto"];

/** The moons by the planet they orbit, in the planets' order. */
const SYSTEMS = [...PLANET_IDS, "pluto" as const]
  .map((host) => ({ host, moons: MOONS.filter((m) => m.host === host) }))
  .filter(({ moons }) => moons.length > 0);

/**
 * Where the autopilot can take the ship, near to far: home, the planets, our probes, the
 * nearest stars, the galaxies and the edge, each with how long the chosen drive takes from
 * the ship's last fix on its clock (never, to the edge: the ship is put there); then the moons
 * by planet. Picking one sets course and opens its card.
 */
export function ObjectsPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("voyage");
  const f = useFormatter();
  const locale = useLocale();
  const drive = useVoyage((s) => s.drive);
  const fix = useVoyage((s) => s.fix);
  const epochMs = useVoyage((s) => s.epochMs);
  const course = useVoyage(courseOf);
  const moment = momentOf(epochMs, fix);
  const go = (id: AnchorId) => {
    const api = useVoyage.getState();
    api.goTo(id);
    api.select(selectionOfAnchor(id));
  };
  const row = (id: AnchorId) => {
    const here = id === course;
    return (
      <ListItem key={id} {...(here ? { selected: true } : {})} onClick={() => go(id)}>
        <span className="min-w-0 truncate">{t(anchorNameKey(id))}</span>
        <span className="shrink-0 font-mono text-[11px] text-muted tabular-nums">
          {here ? NONE : formatTrip(t, f, tripTo(drive, id, fix.km, moment).tau, locale)}
        </span>
      </ListItem>
    );
  };
  const section = (title: string, ids: readonly AnchorId[]) => (
    <RailSection title={title}>
      <div className="flex flex-col gap-0.5">{ids.map(row)}</div>
    </RailSection>
  );
  return (
    <Rail
      id="voyage-objects"
      title={t("hud.destinations")}
      closeLabel={t("hud.close")}
      onClose={onClose}
    >
      <RailSection title={t("hud.tripsBy")}>
        <DriveControl />
      </RailSection>
      {section(t("hud.home"), HOME)}
      {section(t("hud.planets"), PLANETS)}
      {section(t("hud.reach"), PROBE_ANCHOR_IDS)}
      {section(t("hud.stars"), STAR_ANCHOR_IDS)}
      {section(t("hud.galaxies"), GALAXY_ANCHOR_IDS)}
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
            {moons.map(({ id }) => (
              <ListItem
                key={id}
                {...(id === course ? { selected: true } : {})}
                onClick={() => go(id)}
              >
                {t(solarNameKey({ kind: "moon", id }))}
              </ListItem>
            ))}
          </div>
        </RailSection>
      ))}
    </Rail>
  );
}
