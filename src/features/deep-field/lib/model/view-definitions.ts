/** The ordered views, their distance evidence and framing references. Safe for manifests. */
import type { COSMIC_VIEW_LY } from "../../../../space/cosmos/model/cosmos";
import type { Realm } from "../../../../space/galaxy/show";
import { SOLAR_VIEWS, type SolarViewId } from "../../../../space/solar-system/model/views";

type DistanceMethod =
  | "radar"
  | "tracking"
  | "orbits"
  | "comets"
  | "parallax"
  | "galacticCentre"
  | "candles"
  | "flows"
  | "redshift"
  | "cosmology";
type Framing =
  | { solar: SolarViewId }
  | { au: number }
  | { ly: number }
  | { cosmic: keyof typeof COSMIC_VIEW_LY };
type Definition<Id extends string = string> = {
  id: Id;
  realm: Realm;
  method: DistanceMethod;
  framing: Framing;
  azimuth?: number;
  inclination?: number;
};

const ENTRIES = [
  ...SOLAR_VIEWS.flatMap(({ id, method }): Definition<SolarViewId | "heliosphere">[] => {
    const view: Definition<SolarViewId> = { id, realm: "solar", method, framing: { solar: id } };
    return id === "kuiper"
      ? [
          view,
          {
            id: "heliosphere",
            realm: "solar",
            method: "tracking",
            framing: { au: 520 },
            azimuth: 0.9,
            inclination: 0.42,
          },
        ]
      : [view];
  }),
  {
    id: "stars",
    realm: "stars",
    method: "parallax",
    framing: { au: 560_000 },
    azimuth: 2.14,
    inclination: 0.47,
  },
  { id: "galaxy", realm: "galaxy", method: "galacticCentre", framing: { ly: 92_000 } },
  {
    id: "local-group",
    realm: "cosmos",
    method: "candles",
    framing: { cosmic: "localGroup" },
    inclination: 0.36,
  },
  {
    id: "local-sheet",
    realm: "cosmos",
    method: "candles",
    framing: { cosmic: "sheet" },
    inclination: 0.28,
  },
  {
    id: "virgo-cluster",
    realm: "cosmos",
    method: "candles",
    framing: { cosmic: "virgo" },
    inclination: 0.42,
  },
  {
    id: "virgo-supercluster",
    realm: "cosmos",
    method: "flows",
    framing: { cosmic: "supercluster" },
    inclination: 0.5,
  },
  {
    id: "laniakea",
    realm: "cosmos",
    method: "flows",
    framing: { cosmic: "laniakea" },
    inclination: 0.62,
  },
  {
    id: "cosmic-web",
    realm: "cosmos",
    method: "redshift",
    framing: { cosmic: "web" },
    azimuth: 1.2,
    inclination: 0.7,
  },
  {
    id: "observable-universe",
    realm: "cosmos",
    method: "cosmology",
    framing: { cosmic: "universe" },
    inclination: 0.5,
  },
] as const satisfies readonly Definition[];

export type ViewId = (typeof ENTRIES)[number]["id"];
export const VIEW_DEFINITIONS: readonly Definition<ViewId>[] = ENTRIES;
export const VIEW_IDS = ENTRIES.map(({ id }) => id);
export const DEFAULT_VIEW: ViewId = "galaxy";
