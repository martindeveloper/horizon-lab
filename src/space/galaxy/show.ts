/**
 * What the shared worlds beyond the solar system draw with: the switches their layers read, the
 * selections their names and targets open, and the frame an engine hands every layer. A host
 * simulation's store composes these; its own state stays its own.
 */
import type { ReachSelection } from "@/space/solar-system/model/probes";
import type { SolarSelection } from "@/space/solar-system/model/selection";

import type { NeighbourId } from "./model/neighbours";

/**
 * The map that dominates a scale: the solar system, the nearest stars round it, the Galaxy,
 * and the cosmic map beyond it. Cards, rulers and readouts follow it.
 */
export type Realm = "solar" | "stars" | "galaxy" | "cosmos";

/** The switches the Galaxy, the nearest stars, the reach and the cosmic map read. */
export type GalaxyShow = {
  /** The dark-matter halo's sphere. */
  halo: boolean;
  names: boolean;
  /** Dashed rulers with distances from the selection (or home) to what is in view. */
  distances: boolean;
  /** Rings round the Sun at the distance sunlight covers in a minute, an hour, a day… */
  lightTime: boolean;
};

/** The Galaxy map's parts with a card. */
export type GalaxyId = "milkyway" | "sun" | "bulge" | "halo";

/** Structures beyond the Galaxy with a card. */
export type CosmosId =
  | "localGroup"
  | "localSheet"
  | "andromeda"
  | "triangulum"
  | "virgo"
  | "fornax"
  | "supercluster"
  | "centaurus"
  | "hydra"
  | "greatAttractor"
  | "laniakea"
  | "perseusPisces"
  | "coma"
  | "shapley"
  | "sloanGreatWall"
  | "observableUniverse";

/** Anything the shared worlds' names and targets open, the solar system's included. */
export type WorldSelection =
  | SolarSelection
  | { kind: "star"; id: NeighbourId }
  | { kind: "galaxy"; id: GalaxyId }
  | { kind: "cosmos"; id: CosmosId }
  /** The probes leaving the solar system, and the heliopause the Voyagers crossed. */
  | ReachSelection;

/** The model state one frame draws. */
export type WorldFrame = {
  show: GalaxyShow;
  sel: WorldSelection | null;
  /** Camera distance from its aim, au. */
  dist: number;
  /** The line art's presence 0..1 (a drift veils it); labels that name a line follow it. */
  lines: number;
  /**
   * 0..1: the camera stands out among the galaxies, beyond the mapped structures (a ship far
   * from home), so the far field of galaxies is drawn round it whatever the scale in view.
   */
  afield?: number;
  /**
   * 0..1: how much of the Galaxy map is drawn (default 1). A host whose near sky is the painted
   * band (Voyage) brings the map in only as the band gives way.
   */
  galaxyPresence?: number;
};
