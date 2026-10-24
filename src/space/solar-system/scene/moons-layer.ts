/**
 * Major moons, grouped by planet. Each planet's marker is recorded as the planets are placed.
 * Moons are drawn in the ephemeris's era; Earth's Moon also through deep time, from the impact
 * on, its orbit at the distance the tidal records give (model/history.ts), so it draws nearer as
 * time winds back and is gone before the impact.
 */
import { Mesh, Vector3, type Object3D } from "three";

import {
  MOONS,
  orbitShapeOf,
  type BodyId,
  type Moon,
  type MoonHost,
  type MoonId,
  type Vec3,
} from "@horizon/toolkit/bodies";
import { smoothstep } from "@horizon/toolkit/math";
import { type OrbitLine, ownedOrbitLine, type PlaceLabel } from "@horizon/toolkit/scene";
import { AU_KM } from "@horizon/toolkit/science";

import { moonOffset, moonOrientation } from "../graphics/moons";
import { moonDistanceRatio, moonExists } from "../model/history";
import { moonOrbitShape } from "../model/moon-orbits";
import { hostOf, type SolarSelection } from "../model/selection";
import type { Globes } from "./geometry";
import {
  ORBIT_COLOR,
  SMALL_ORBIT_COLOR,
  type ShownFor,
  type SolarFrame,
  type SolarKit,
} from "./kit";

/** Moon dots: Ganymede's size in pixels; smaller moons scale with radius, down to the floor. */
const MOON_PX = 4.5;
const MOON_PX_MIN = 2.2;
/** A selected planet's innermost moon clears its marker (and rings) by this many pixels. */
const MOON_CLEAR_PX = 12;
/**
 * A moon shows once it clears its planet's marker by this many pixels (eased over the span), as
 * does anything else in orbit about a planet (Earth's observatories).
 */
export const SEPARATE_PX = [6, 10] as const;
const SELECTED_PX = [3, 6] as const;
/**
 * A system spreads as if selected while the camera is this near its planet, as fractions of
 * the planet's distance from the Sun: Earth's within 0.3 au, Jupiter's within 1.6 au.
 */
const NEAR = [0.3, 0.5] as const;
/** A moon's touch target, screen pixels; where targets overlap, the nearer centre wins (chooseSolarHit). */
const TOUCH_PX = 16;
/**
 * A magnified system reaches at most this many times its innermost orbit: Jupiter's and
 * Uranus's moons fit (4.5) and spread evenly; Saturn's, Mimas to Iapetus (19), are drawn
 * closer by a power law that keeps their order.
 */
const SPREAD = 5;

type Host = { position: Vector3; extent: number; on: boolean };
export type MoonHosts = ReadonlyMap<string, Host>;
type MoonSlot = {
  moon: Moon;
  mesh: Mesh;
  /** Touch target: raycast, never drawn. */
  hit: Mesh;
  offset: Vector3;
  orbit: OrbitLine;
  dotPx: number;
  /** Its magnification relative to the innermost moon's, (inner / a)^(1 − squeeze). */
  lift: number;
};

export function createMoonsLayer(
  { scope, looks, camera, pxWorld, lod }: SolarKit,
  parent: Object3D,
  globes: Globes,
  place: PlaceLabel,
  deps: {
    /** The body in close-up: a moon there stays drawn whatever its system's state. */
    closeId: () => BodyId | null;
    /** A moon's own label fades as its close-up fills the view. */
    shownFor: ShownFor;
  },
) {
  const { closeId, shownFor } = deps;
  const systems = [...new Set(MOONS.map((m) => m.host))].map((id: MoonHost) => {
    const moons = MOONS.filter((m) => m.host === id).map((moon): MoonSlot => {
      const mesh = new Mesh(globes.small, looks.ghost);
      mesh.visible = false;
      const hit = new Mesh(globes.hit, looks.ghost);
      hit.userData.pick = { kind: "moon", id: moon.id } satisfies SolarSelection;
      hit.userData.globe = mesh;
      hit.visible = false;
      const orbit = ownedOrbitLine(
        scope,
        id === "pluto" ? SMALL_ORBIT_COLOR : ORBIT_COLOR[id],
        0.45,
      );
      orbit.line.visible = false;
      parent.add(mesh, hit, orbit.line);
      const dotPx = Math.max(MOON_PX_MIN, MOON_PX * Math.sqrt(moon.radiusKm / 2631.2));
      return { moon, mesh, hit, offset: new Vector3(), orbit, dotPx, lift: 1 };
    });
    const apsides = moons.map((m) => m.moon.aKm / AU_KM);
    const host: Host = { position: new Vector3(), extent: 0, on: false };
    const inner = Math.min(...apsides);
    const outer = Math.max(...apsides);
    /* Magnified radii go as (a / inner)^squeeze: 1 keeps the system's shape. */
    const squeeze = Math.min(1, Math.log(SPREAD) / Math.log(outer / inner));
    for (const slot of moons) slot.lift = (inner / (slot.moon.aKm / AU_KM)) ** (1 - squeeze);
    const outerLift = (inner / outer) ** (1 - squeeze);
    /**
     * How far the drawn system reaches from the planet, for the close-up depth pass, and how
     * many times its innermost moon's distance it is drawn at (1: true scale).
     */
    return {
      id,
      host,
      moons,
      inner,
      outer,
      outerLift,
      reach: 0,
      magnified: 1,
      focus: lod.fader(0.7),
    };
  });
  const present = lod.fader();
  /** The Moon's own era: from the impact on. */
  const lunar = lod.fader();
  const names = lod.fader();
  const hosts: MoonHosts = new Map(systems.map((system) => [system.id, system.host]));
  const systemOf = (id: BodyId) => systems.find((s) => s.id === id);
  const slots = new Map(systems.flatMap((s) => s.moons.map((slot) => [slot.moon.id, slot])));
  const drawn: Vec3 = [0, 0, 0];
  const shape = orbitShapeOf();

  return {
    hosts,
    labelBodies: systems.flatMap((system) =>
      system.moons.map(({ moon, mesh }) => ({ key: moon.id, mesh })),
    ),
    /** Every moon's touch target, shown while its moon is. */
    pickables: [...slots.values()].map((slot) => slot.hit),
    /** A moon's globe, for its own close-up pass. */
    meshOf(id: MoonId): Mesh {
      return slots.get(id)!.mesh;
    },
    /** Where a moon is drawn this frame (its system may be magnified), or null while hidden. */
    drawnAt(id: MoonId): Vec3 | null {
      const mesh = slots.get(id)?.mesh;
      if (!mesh?.visible) return null;
      drawn[0] = mesh.position.x;
      drawn[1] = mesh.position.y;
      drawn[2] = mesh.position.z;
      return drawn;
    },
    /** The meshes and orbit lines of a body's moons, for its close-up pass. */
    objectsOf(id: BodyId): Object3D[] {
      return systemOf(id)?.moons.flatMap((m) => [m.mesh, m.orbit.line]) ?? [];
    },
    reachOf(id: BodyId) {
      return systemOf(id)?.reach ?? 0;
    },
    /** How many times its true distance a planet's innermost moon is drawn at now; 1 unmagnified. */
    magnifiedOf(id: MoonHost) {
      return systemOf(id)?.magnified ?? 1;
    },
    /* Moons sit at today's positions (the clock, not the Motion speed-up, which
       would whirl them). A selected or nearby planet's system is magnified about the
       planet until its innermost moon clears the marker, but never past the
       planet's distance from the Sun; a wide system's outer moons less (SPREAD).
       True size keeps every distance real. */
    update({ now, show, sel, present: today, yearsAgo }: SolarFrame) {
      const era = present.to(today);
      const moonEra = Math.max(era, lunar.to(moonExists(yearsAgo)));
      /* The Moon's distance over today's: its offset and orbit shrink with it. */
      const recession = moonDistanceRatio(yearsAgo);
      const labelled = names.to(show.names);
      for (const system of systems) {
        const { host } = system;
        const earth = system.id === "earth";
        const recede = earth ? recession : 1;
        /* Pixel sizes at the planet, not the aim: a far system (Charon seen from Mars) is a
           point, so it neither shows nor labels; at the aim the two agree. */
        const range = Math.max(1e-12, camera.position.distanceTo(host.position));
        /** Screen pixels per world unit at the planet. */
        const perPx = 1 / pxWorld(range, 1);
        /* Selecting a moon selects its system too, so the moon stays clear of its planet. */
        const selected =
          ((sel?.kind === "planet" || sel?.kind === "named") && sel.id === system.id) ||
          (sel?.kind === "moon" && hostOf(sel.id).id === system.id);
        const near = 1 - smoothstep(NEAR[0], NEAR[1], range / host.position.length());
        const focus = Math.max(system.focus.to(selected), near);
        const shown =
          (earth ? moonEra : era) *
          (host.on ? 1 : 0) *
          Math.max(
            focus,
            smoothstep(SEPARATE_PX[0], SEPARATE_PX[1], (system.outer - host.extent) * perPx),
          );
        /* The system magnifies smoothly as the selection eases in or the camera nears. */
        let spread = 0;
        if (shown > 0 && focus > 0 && !show.trueSize) {
          const clear = Math.max(host.extent + pxWorld(range, MOON_CLEAR_PX), pxWorld(range, 26));
          const room = host.position.length() / (system.outer * system.outerLift);
          spread = Math.min(clear / system.inner, room);
        }
        const hidden = host.extent + (show.trueSize ? 0 : pxWorld(range, 3));
        const [from, to] = focus > 0.5 ? SELECTED_PX : SEPARATE_PX;
        system.reach = 0;
        system.magnified = 1 + (Math.max(1, spread) - 1) * focus;
        for (const slot of system.moons) {
          const { moon, mesh, hit, offset, orbit } = slot;
          const magnify = 1 + (Math.max(1, spread * slot.lift) - 1) * focus;
          /* A close-up keeps its moon on whatever its system's state. */
          const close = closeId() === moon.id;
          if (shown > 0 || close) moonOffset(moon.id, now, offset).multiplyScalar(recede);
          const reach = offset.length() * magnify;
          const clears = reach > hidden ? smoothstep(from, to, (reach - host.extent) * perPx) : 0;
          const presence = close ? 1 : shown * clears;
          const on = presence > 0.004;
          mesh.visible = on;
          hit.visible = on && !close;
          orbit.line.visible = on;
          if (on) {
            mesh.position.copy(host.position).addScaledVector(offset, magnify);
            /* The dot's floor at the moon's own distance: in its close-up the planet is far. */
            const near = Math.max(1e-12, camera.position.distanceTo(mesh.position));
            const real = moon.radiusKm / AU_KM;
            const radius = show.trueSize
              ? real
              : Math.max(real * magnify, pxWorld(near, slot.dotPx));
            /* Markers grow in; true size never changes size. */
            mesh.scale.setScalar(show.trueSize ? radius : radius * presence);
            system.reach = Math.max(
              system.reach,
              (moon.aKm / AU_KM) * (1 + moon.e) * magnify * recede + radius,
            );
            moonOrientation(moon.id, now, mesh.quaternion);
            if (mesh.material === looks.ghost) mesh.material = looks.moon(moon.id);
            globes.fit(mesh, mesh.position, radius, globes.small);
            lod.see(moon.id, lod.px(radius, mesh.position));
            hit.position.copy(mesh.position);
            hit.scale.setScalar(Math.max(radius, pxWorld(near, TOUCH_PX)));
            orbit.line.position.copy(host.position);
            orbit.line.scale.setScalar(magnify * recede);
            orbit.material.opacity = 0.45 * presence;
            orbit.set(moonOrbitShape(moon.id, now, shape));
          }
          place(
            moon.id,
            mesh.position.x,
            mesh.position.y,
            mesh.position.z,
            labelled * (on ? presence : 0) * shownFor(moon.id),
          );
        }
      }
    },
  };
}
