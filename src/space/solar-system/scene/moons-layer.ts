/** Major moons, grouped by planet. Each planet's marker is recorded as the planets are placed. */
import { Mesh, Vector3, type Object3D } from "three";

import { MOONS, type BodyId, type Moon, type MoonHost } from "@horizon/toolkit/bodies";
import { smoothstep } from "@horizon/toolkit/math";
import { type LineSlot, ownedLine, type PlaceLabel } from "@horizon/toolkit/scene";
import { AU_KM } from "@horizon/toolkit/science";

import { moonOffset, moonOrientation, writeMoonOrbit } from "../graphics/moons";
import type { Globes } from "./geometry";
import { ORBIT_COLOR, type SolarFrame, type SolarKit } from "./kit";

/** Moon dots: Ganymede's size in pixels; smaller moons scale with radius, down to the floor. */
const MOON_PX = 4.5;
const MOON_PX_MIN = 2.2;
/** A selected planet's innermost moon clears its marker (and rings) by this many pixels. */
const MOON_CLEAR_PX = 12;
/** A moon shows once it clears its planet's marker by this many pixels (eased over the span). */
const SEPARATE_PX = [6, 10] as const;
const SELECTED_PX = [3, 6] as const;

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
  { scope, looks, camera, pxWorld, lod }: SolarKit,
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
    return { id, host, moons, inner, outer, reach: 0, focus: lod.fader(0.7) };
  });
  const present = lod.fader();
  const names = lod.fader();
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
    update({ now, show, sel, present: today }: SolarFrame) {
      const day = Math.floor(now.getTime() / 86_400_000);
      const era = present.to(today);
      const labelled = names.to(show.names);
      for (const system of systems) {
        const { host } = system;
        /* Pixel sizes at the planet, not the aim: a far system (Charon seen from Mars) is a
           point, so it neither shows nor labels; at the aim the two agree. */
        const range = Math.max(1e-12, camera.position.distanceTo(host.position));
        /** Screen pixels per world unit at the planet. */
        const perPx = 1 / pxWorld(range, 1);
        const selected = (sel?.kind === "planet" || sel?.kind === "named") && sel.id === system.id;
        const focus = system.focus.to(selected);
        const shown =
          era *
          (host.on ? 1 : 0) *
          Math.max(
            focus,
            smoothstep(SEPARATE_PX[0], SEPARATE_PX[1], (system.outer - host.extent) * perPx),
          );
        /* The selected system magnifies smoothly as the selection eases in. */
        let magnify = 1;
        if (shown > 0 && focus > 0 && !show.trueSize) {
          const clear = Math.max(host.extent + pxWorld(range, MOON_CLEAR_PX), pxWorld(range, 26));
          const room = host.position.length() / system.outer;
          magnify = 1 + (Math.max(1, Math.min(clear / system.inner, room)) - 1) * focus;
        }
        const hidden = host.extent + (show.trueSize ? 0 : pxWorld(range, 3));
        const [from, to] = selected ? SELECTED_PX : SEPARATE_PX;
        system.reach = 0;
        for (const slot of system.moons) {
          const { moon, mesh, offset, orbit } = slot;
          if (shown > 0) moonOffset(moon.id, now, offset);
          const reach = offset.length() * magnify;
          const clears = reach > hidden ? smoothstep(from, to, (reach - host.extent) * perPx) : 0;
          const presence = shown * clears;
          const on = presence > 0.004;
          mesh.visible = on;
          orbit.line.visible = on;
          if (on) {
            mesh.position.copy(host.position).addScaledVector(offset, magnify);
            const real = moon.radiusKm / AU_KM;
            const radius = show.trueSize
              ? real
              : Math.max(real * magnify, pxWorld(range, slot.dotPx));
            /* Markers grow in; true size never changes size. */
            mesh.scale.setScalar(show.trueSize ? radius : radius * presence);
            system.reach = Math.max(
              system.reach,
              (moon.aKm / AU_KM) * (1 + moon.e) * magnify + radius,
            );
            moonOrientation(moon.id, now, mesh.quaternion);
            if (mesh.material === looks.ghost) mesh.material = looks.moon(moon.id);
            globes.fit(mesh, mesh.position, radius, globes.small);
            lod.see(moon.id, lod.px(radius, mesh.position));
            orbit.line.position.copy(host.position);
            orbit.line.scale.setScalar(magnify);
            orbit.material.opacity = 0.45 * presence;
            if (slot.orbitDay !== day) {
              slot.orbitDay = day;
              writeMoonOrbit(orbit.positions, moon.id, now);
              orbit.geometry.getAttribute("position").needsUpdate = true;
            }
          }
          place(
            moon.id,
            mesh.position.x,
            mesh.position.y,
            mesh.position.z,
            labelled * (on ? presence : 0),
          );
        }
      }
    },
  };
}
