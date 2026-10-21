import { factsOf, type Value } from "@/lib/facts";
import type { SourceId } from "@/lib/sources";

/** Where the Voyagers met the edges of the Sun's wind: their tracks read on the dates published. */
import { crossingAu, probeById, type ProbeId } from "./probes";

function crossing(
  id: ProbeId,
  boundary: "shock" | "heliopause",
  source: SourceId,
  published: number,
): Value {
  return {
    value: crossingAu(id, boundary),
    unit: "au",
    digits: 3,
    source,
    status: "derived",
    note: `JPL Horizons track on ${probeById(id).crossed![boundary]}; published ${published} au`,
  };
}

export const PROBE_CATALOGUE = {
  voyager1: {
    shock: crossing("voyager1", "shock", "stone2005", 94),
    heliopause: crossing("voyager1", "heliopause", "stone2013", 121.6),
  },
  voyager2: {
    shock: crossing("voyager2", "shock", "stone2008", 84),
    heliopause: crossing("voyager2", "heliopause", "stone2019", 119),
  },
} satisfies Record<string, Record<string, Value>>;

/** Every fact with its path ("probes.voyager1.shock"), for tests and the ledger. */
export const probeCatalogueFacts = () => factsOf({ probes: PROBE_CATALOGUE });
