/** Major moons, grouped by planet. Each planet's marker is recorded as the planets are placed. */
import { Mesh, Vector3, type Object3D } from "three";

import { MOONS, type BodyId, type Moon, type MoonHost } from "@horizon/toolkit/bodies";
import { AU_KM } from "@horizon/toolkit/science";

import { moonOffset, moonOrientation, writeMoonOrbit } from "../graphics/moons";
import { ownedLine, type Globes, type LineSlot } from "./geometry";
import { ORBIT_COLOR, type Frame, type SceneKit } from "./kit";
import type { PlaceLabel } from "./labels";

/** Moon dots: Ganymede's size in pixels; smaller moons scale with radius, down to the floor. */
const MOON_PX = 4.5;
const MOON_PX_MIN = 2.2;
/** A selected planet's innermost moon clears its marker (and rings) by this many pixels. */
const MOON_CLEAR_PX = 12;

type Host = { position: Vector3; extent: number; on: boolean };
export type MoonHosts = ReadonlyMap<string, Host>;
type MoonSlot = {
  moon: Moon;
  mesh: Mesh;
  offset: Vector3;
  orbit: LineSlot;
  orbitDay: number;
  dotPx: number;
};

export function createMoonsLayer(
  { scope, looks, pxWorld }: SceneKit,
  parent: Object3D,
  globes: Globes,
  place: PlaceLabel,
) {
  const systems = [...new Set(MOONS.map((m) => m.host))].map((id: MoonHost) => {
    const moons = MOONS.filter((m) => m.host === id).map((moon): MoonSlot => {
      const mesh = new Mesh(globes.small, looks.ghost);
      mesh.visible = false;
      const orbit = ownedLine(scope, id === "pluto" ? 0x9ebccc : ORBIT_COLOR[id], 0.45);
      orbit.line.visible = false;
      parent.add(mesh, orbit.line);
      const dotPx = Math.max(MOON_PX_MIN, MOON_PX * Math.sqrt(moon.radiusKm / 2631.2));
      return { moon, mesh, offset: new Vector3(), orbit, orbitDay: NaN, dotPx };
    });
    const apsides = moons.map((m) => m.moon.aKm / AU_KM);
    const host: Host = { position: new Vector3(), extent: 0, on: false };
    const inner = Math.min(...apsides);
    const outer = Math.max(...apsides);
    /** How far the drawn system reaches from the planet, for the close-up depth pass. */
    return { id, host, moons, inner, outer, reach: 0 };
  });
  const hosts: MoonHosts = new Map(systems.map((system) => [system.id, system.host]));
  const systemOf = (id: BodyId) => systems.find((s) => s.id === id);

  return {
    hosts,
    labelBodies: systems.flatMap((system) =>
      system.moons.map(({ moon, mesh }) => ({ key: moon.id, mesh })),
    ),
    /** The meshes and orbit lines of a body's moons, for its close-up pass. */
    objectsOf(id: BodyId): Object3D[] {
      return systemOf(id)?.moons.flatMap((m) => [m.mesh, m.orbit.line]) ?? [];
    },
    reachOf(id: BodyId) {
      return systemOf(id)?.reach ?? 0;
    },
    /* Moons sit at today's positions (the clock, not the Motion speed-up, which
       would whirl them). A selected planet's system is magnified about the
       planet until its innermost moon clears the marker, but never past the
       planet's distance from the Sun; True size keeps every distance real. */
    update({ now, show, sel, dist, present }: Frame) {
      const day = Math.floor(now.getTime() / 86_400_000);
      for (const system of systems) {
        const { host } = system;
        const selected = (sel?.kind === "planet" || sel?.kind === "named") && sel.id === system.id;
        const separate = system.outer - host.extent > pxWorld(dist, 8);
        const active = present && host.on && (selected || separate);
        let magnify = 1;
        if (active && selected && !show.trueSize) {
          const clear = Math.max(host.extent + pxWorld(dist, MOON_CLEAR_PX), pxWorld(dist, 26));
          const room = host.position.length() / system.outer;
          magnify = Math.max(1, Math.min(clear / system.inner, room));
        }
        const hidden = host.extent + (show.trueSize ? 0 : pxWorld(dist, 3));
        system.reach = 0;
        for (const slot of system.moons) {
          const { moon, mesh, offset, orbit } = slot;
          if (active) moonOffset(moon.id, now, offset);
          const reach = offset.length() * magnify;
          const on =
            active && reach > hidden && (selected || reach - host.extent > pxWorld(dist, 8));
          mesh.visible = on;
          orbit.line.visible = on;
          if (on) {
            mesh.position.copy(host.position).addScaledVector(offset, magnify);
            const real = moon.radiusKm / AU_KM;
            const radius = show.trueSize
              ? real
              : Math.max(real * magnify, pxWorld(dist, slot.dotPx));
            mesh.scale.setScalar(radius);
            system.reach = Math.max(
              system.reach,
              (moon.aKm / AU_KM) * (1 + moon.e) * magnify + radius,
            );
            moonOrientation(moon.id, now, mesh.quaternion);
            if (mesh.material === looks.ghost) mesh.material = looks.moon(moon.id);
            mesh.geometry = globes.globeFor(mesh.position, radius, globes.small);
            orbit.line.position.copy(host.position);
            orbit.line.scale.setScalar(magnify);
            if (slot.orbitDay !== day) {
              slot.orbitDay = day;
              writeMoonOrbit(orbit.positions, moon.id, now);
              orbit.geometry.getAttribute("position").needsUpdate = true;
            }
          }
          place(moon.id, mesh.position.x, mesh.position.y, mesh.position.z, show.names && on);
        }
      }
    },
  };
}
