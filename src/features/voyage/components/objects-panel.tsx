import { Satellite } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { BodyOrb, GLYPH_ICON } from "@/components/simulations/body-orb";
import { Rail, RailSection } from "@/components/simulations/rail";
import { neighbour } from "@/space/galaxy/model/neighbours";
import { solarNameKey } from "@/space/solar-system/format";
import { MOONS, PLANET_IDS } from "@horizon/toolkit/bodies";
import { includesId } from "@horizon/toolkit/records";
import { ListItem, Orb } from "@horizon/toolkit/ui";

import {
  GALAXY_ANCHOR_IDS,
  PROBE_ANCHOR_IDS,
  STAR_ANCHOR_IDS,
  anchorNameKey,
  isBodyAnchor,
  isProbeAnchor,
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
 * A destination's mark: a body lit in its colour, a probe, a star in its light, the Galaxy's
 * centre a horizon, a galaxy or cluster a haze, the edge a dotted bound.
 */
function AnchorGlyph({ id }: { id: AnchorId }) {
  if (isBodyAnchor(id)) return <BodyOrb id={id} />;
  if (isProbeAnchor(id)) return <Satellite aria-hidden className={GLYPH_ICON} />;
  if (includesId(STAR_ANCHOR_IDS, id)) return <Orb look="glow" color={neighbour(id).color} />;
  if (id === "galacticCentre") return <Orb look="hole" size={8} />;
  if (id === "edge") return <Orb look="swarm" />;
  return <Orb look="haze" size={16} />;
}

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
      <ListItem
        key={id}
        {...(here ? { selected: true } : {})}
        icon={<AnchorGlyph id={id} />}
        detail={here ? NONE : formatTrip(t, f, tripTo(drive, id, fix.km, moment).tau, locale)}
        onClick={() => go(id)}
      >
        {t(anchorNameKey(id))}
      </ListItem>
    );
  };
  const section = (title: string, ids: readonly AnchorId[]) => (
    <RailSection title={title} count={ids.length}>
      <div className="-mx-3 grid gap-0.5">{ids.map(row)}</div>
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
          count={moons.length}
        >
          <div className="-mx-3 grid grid-cols-2 gap-0.5">
            {moons.map(({ id }) => (
              <ListItem
                key={id}
                {...(id === course ? { selected: true } : {})}
                icon={<BodyOrb id={id} />}
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
