import { factsOf, type Value } from "@/lib/facts";
import { convert } from "@horizon/toolkit/science";

/**
 * The observatories' card figures: each orbit as its element set gives it, the L2 point that
 * Webb circles as the Sun's, Earth's and the Moon's masses put it, and how long Webb's track
 * takes round it.
 */
import {
  EARTH_J2,
  L2_KM,
  WEBB_HALO_DAYS,
  elementEpoch,
  satelliteFigures,
  type SatelliteId,
} from "./observatories";

/** Hubble's or Chandra's orbit: heights above the equator, period (in `period`'s unit) and tilt. */
function satellite(id: SatelliteId, period: "min" | "h") {
  const { perigeeKm, apogeeKm, periodS, i } = satelliteFigures(id);
  const set = `CelesTrak element set of ${elementEpoch(id).toISOString().slice(0, 10)}`;
  const km = (value: number, what: string): Value => ({
    value,
    unit: "km",
    digits: 3,
    source: "celestrakGp",
    status: "derived",
    note: `${set}: ${what} above the equator`,
  });
  return {
    perigee: km(perigeeKm, "lowest"),
    apogee: km(apogeeKm, "highest"),
    period: {
      value: convert(periodS, "s", period),
      unit: period,
      digits: 3,
      source: "celestrakGp",
      status: "derived",
      note: `${set}: from its mean motion`,
    },
    tilt: {
      value: i,
      unit: "deg",
      digits: 3,
      source: "celestrakGp",
      status: "verified",
      note: `${set}: to Earth's equator`,
    },
  } satisfies Record<string, Value>;
}

export const OBSERVATORY_CATALOGUE = {
  hubble: satellite("hubble", "min"),
  chandra: satellite("chandra", "h"),
  webb: {
    l2: {
      value: L2_KM,
      unit: "km",
      digits: 2,
      source: "iau2015b3",
      sources: ["park2021", "nasaWebbFacts"],
      status: "derived",
      note: "beyond Earth, from the Sun's, Earth's and the Moon's GM at one au; NASA gives 1.5 million km",
    },
    halo: {
      value: WEBB_HALO_DAYS,
      unit: "d",
      digits: 2,
      source: "horizonsWebb",
      status: "derived",
      note: "mean time between its track's crossings of the plane through the Sun–Earth line; NASA: about six months",
    },
  },
  earth: { j2: EARTH_J2 },
} satisfies Record<string, Record<string, Value>>;

/** Every fact with its path ("observatories.hubble.period"), for tests and the ledger. */
export const observatoryCatalogueFacts = () => factsOf({ observatories: OBSERVATORY_CATALOGUE });
