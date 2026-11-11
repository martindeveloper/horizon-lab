import { distanceVec3d, vec3d, type Vec3d } from "@horizon/toolkit/scene";

import { isBodyAnchor, type AnchorId } from "../model/anchors";
import { worldBody } from "../model/bodies";
import {
  PIECES_PER_DYNAMICAL_TIME,
  createWell,
  dynamicalTime,
  gmOf,
  gravityAt,
  hillRadius,
} from "../model/gravity";
import type { ShipGravity, ShipState } from "../model/ship";

/** The bodies' positions on the scene clock. */
export type ShipEphemeris = {
  bodyAt: (id: AnchorId, date: Date, out: Vec3d) => Vec3d;
  now: () => Date;
};
/** Pieces a frame of manual flight is cut into at most; past it the warp holds back near a body. */
const MAX_PIECES = 400;
/** Seconds the velocity of the body the ship rides is measured over. */
const VELOCITY_S = 60;

/**
 * The local gravity wells, their motion, the body whose frame the ship flies in, and the
 * frame's safe integration step. `orbitOf` is how far from a body the ship parks, km.
 */
export function createShipEnvironment(
  options: ShipEphemeris & { nearest: (at: Vec3d) => AnchorId },
  ship: ShipState,
  orbitOf: (id: AnchorId) => number,
) {
  const { bodyAt } = options;
  const earlier = vec3d();
  const later = vec3d();
  const moonPos = vec3d();
  const hostPos = vec3d();
  const pull = vec3d();
  const dateLater = new Date();
  /** The pull on the ship, km/s², and the body pulling hardest, as last read. */
  const pulled: { gravity: number; from: AnchorId } = { gravity: 0, from: "sun" };
  /** A body's heliocentric velocity, km/s, from its motion over a minute. */
  const bodyVelocity = (id: AnchorId, out: Vec3d) => {
    const now = options.now();
    bodyAt(id, now, earlier);
    dateLater.setTime(now.getTime() + VELOCITY_S * 1000);
    bodyAt(id, dateLater, later);
    out[0] = (later[0] - earlier[0]) / VELOCITY_S;
    out[1] = (later[1] - earlier[1]) / VELOCITY_S;
    out[2] = (later[2] - earlier[2]) / VELOCITY_S;
    return out;
  };

  /**
   * The body whose frame a ship flown by hand is in: what its markers, its brake and its aim
   * work against. It is the body whose surface is nearest (`near`), but a moon takes the frame
   * from its planet only within its reach: its Hill sphere, or the orbit the ship parks in
   * about it where that is wider (the small moons'). A moon that `held` the frame keeps it
   * while its surface is the nearest. So a ship parked at a moon leaves in the moon's frame,
   * and a moon passing a ship at its planet never takes the planet's.
   */
  const frameOf = (held: AnchorId, near: AnchorId): AnchorId => {
    if (near === held || !isBodyAnchor(near)) return near;
    const world = worldBody(near);
    if (world.kind !== "moon") return near;
    const now = options.now();
    bodyAt(near, now, moonPos);
    bodyAt(world.host, now, hostPos);
    const reach = Math.max(
      hillRadius(distanceVec3d(moonPos, hostPos), gmOf(near), gmOf(world.host)),
      orbitOf(near),
    );
    return distanceVec3d(ship.x, moonPos) <= reach ? near : world.host;
  };

  /** The wells a ship near a body falls in: the Sun, the body, and its planet or its big moon. */
  const wells = [createWell(), createWell(), createWell()];
  const wellIds: (AnchorId | null)[] = [null, null, null];
  const partnerOf = (id: AnchorId): AnchorId | null => {
    if (id === "earth") return "moon";
    if (!isBodyAnchor(id)) return null;
    const world = worldBody(id);
    return world.kind === "moon" ? world.host : null;
  };
  /** Loads the wells about `near` as they are now, with their velocities when the ship will fall. */
  const loadWells = (near: AnchorId, moving: boolean) => {
    const now = options.now();
    const partner = partnerOf(near);
    wellIds[0] = "sun";
    wellIds[1] = near === "sun" ? null : near;
    wellIds[2] = partner;
    for (let i = 0; i < wells.length; i += 1) {
      const id = wellIds[i];
      const well = wells[i]!;
      well.gm = id ? gmOf(id) : 0;
      if (!id || well.gm <= 0) continue;
      bodyAt(id, now, well.pos);
      if (moving) bodyVelocity(id, well.vel);
      else well.vel[0] = well.vel[1] = well.vel[2] = 0;
    }
  };
  const gravity: ShipGravity = { at: (x, dt, out) => gravityAt(x, wells, dt, out), pieces: 1 };

  /** Reads the pull where the ship is now, and the body pulling hardest. */
  const readGravity = () => {
    loadWells(options.nearest(ship.x), false);
    gravityAt(ship.x, wells, 0, pull);
    pulled.gravity = Math.hypot(pull[0], pull[1], pull[2]);
    let hardest = 0;
    for (let i = 0; i < wells.length; i += 1) {
      const well = wells[i]!;
      if (well.gm <= 0) continue;
      const g = well.gm / Math.max(1e-9, distanceVec3d(ship.x, well.pos) ** 2);
      if (g > hardest) {
        hardest = g;
        pulled.from = wellIds[i]!;
      }
    }
    return pulled;
  };

  return {
    bodyVelocity,
    frameOf,
    readGravity,
    gravity,
    loadGravity(this: void, near: AnchorId, dtau: number) {
      loadWells(near, true);
      let shortest = Infinity;
      for (const well of wells)
        if (well.gm > 0)
          shortest = Math.min(shortest, dynamicalTime(distanceVec3d(ship.x, well.pos), well.gm));
      const piece = shortest / PIECES_PER_DYNAMICAL_TIME;
      if (dtau > MAX_PIECES * piece) dtau = MAX_PIECES * piece;
      gravity.pieces = Number.isFinite(piece) ? Math.ceil(dtau / piece) : 1;
      return dtau;
    },
  };
}
