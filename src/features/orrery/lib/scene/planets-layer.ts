/** Planets and named small bodies: globes, rings, orbits and labels. */
import { Group, Mesh, Quaternion, RingGeometry, Sprite, Vector3, type Object3D } from "three";

import {
  FIGURES,
  NAMED,
  PLANET_IDS,
  RINGS,
  keplerPosition,
  type BodyId,
} from "@horizon/toolkit/bodies";
import { AU_KM } from "@horizon/toolkit/science";

import { bodyOrientation } from "../graphics/coordinates";
import { namedElements, orbitInView, planetElements, rewinds } from "../model/elements";
import { SUN_BIRTH } from "../model/parameters";
import { planetGrowth } from "../model/timeline";
import type { Selection, Show } from "../store";
import { orbitOf, type Globes } from "./geometry";
import { GOLD, ORBIT_COLOR, type Frame, type HidesFor, type SceneKit } from "./kit";
import type { PlaceLabel } from "./labels";
import type { MoonHosts } from "./moons-layer";
import type { Rulers } from "./rulers";

/** Equatorial and polar radius over the mean radius: the giants' oblate figures. */
const shapeOf = (id: BodyId) =>
  [
    FIGURES[id].equatorialKm / FIGURES[id].meanKm,
    FIGURES[id].polarKm / FIGURES[id].meanKm,
  ] as const;

export type PlanetsLayer = ReturnType<typeof createPlanetsLayer>;

export function createPlanetsLayer(
  kit: SceneKit,
  parent: Object3D,
  deps: {
    globes: Globes;
    place: PlaceLabel;
    rulers: Rulers;
    hosts: MoonHosts;
    hidesFor: HidesFor;
    /** The body in close-up, which stays drawn whatever the layers say. */
    closeId: () => BodyId | null;
  },
) {
  const { scope, looks, pxWorld } = kit;
  const { globes, place, rulers, hosts, hidesFor, closeId } = deps;
  const dotRadius = (show: Show, dist: number, cap: number, real: number, px: number) =>
    show.trueSize ? real : Math.min(cap, Math.max(real, pxWorld(dist, px)));

  const planets = PLANET_IDS.map((id) => {
    const group = new Group();
    const body = new Mesh(globes.sphere, looks.planets[id]);
    const hit = new Mesh(globes.hit, looks.ghost);
    hit.userData.pick = { kind: "planet", id } satisfies Selection;
    group.add(hit, body);
    /* Rings lie in the equatorial plane, so they follow the body's real pole. */
    const system = RINGS[id];
    const ringLook = looks.rings[id];
    if (system && ringLook) {
      const eq = FIGURES[id].equatorialKm;
      const geometry = new RingGeometry(system.innerKm / eq, system.outerKm / eq, 128, 1);
      const ring = new Mesh(scope.own(geometry), ringLook);
      ring.rotation.x = -Math.PI / 2;
      body.add(ring);
    }
    parent.add(group);
    /* Rings reach past the globe; moons must clear them too. */
    const reach = system ? system.outerKm / FIGURES[id].equatorialKm : 1;
    const orbit = orbitOf(scope, ORBIT_COLOR[id], 0.62);
    return { id, group, body, hit, shape: shapeOf(id), ring: ringLook, reach, orbit };
  });

  const named = NAMED.map((body) => {
    const mesh = new Mesh(globes.small, looks.named[body.id]);
    mesh.userData.pick = { kind: "named", id: body.id } satisfies Selection;
    if (body.id === "halley") {
      const coma = new Sprite(looks.halleyComa);
      coma.scale.set(4.2, 4.2, 1);
      mesh.add(coma);
    }
    parent.add(mesh);
    const orbit = orbitOf(scope, body.id === "halley" ? 0xc4705a : 0x9ebccc, 0.7);
    return { body, mesh, orbit };
  });
  for (const slot of [...planets, ...named]) parent.add(slot.orbit.line);

  const tmp: [number, number, number] = [0, 0, 0];
  const orientation = new Quaternion();
  const poleWorld = new Vector3();

  const updatePlanets = ({ now, show, sel, yearsAgo, mig, driftYears, dist }: Frame) => {
    for (const planet of planets) {
      const el = planetElements(planet.id, mig, driftYears, now);
      keplerPosition(el, tmp);
      planet.group.position.set(tmp[0], tmp[1], tmp[2]);
      const real = FIGURES[planet.id].meanKm / AU_KM;
      const grown = planetGrowth(planet.id, yearsAgo);
      const r = dotRadius(show, dist, Math.max(real, el.a * 0.16), real, 13);
      planet.group.visible = grown > 0.02;
      const radius = Math.max(r, real) * (0.3 + 0.7 * grown);
      const [eq, polar] = planet.shape;
      planet.body.scale.set(radius * eq, radius * polar, radius * eq);
      /* Real pole and today's rotation angle, from the clock rather than the
         Motion speed-up, which would only strobe the spin. */
      planet.body.quaternion.copy(bodyOrientation(planet.id, now, orientation));
      planet.body.geometry = globes.globeFor(planet.group.position, radius * eq);
      const host = hosts.get(planet.id);
      if (host) {
        host.position.copy(planet.group.position);
        host.extent = radius * eq * planet.reach;
        host.on = grown > 0.02;
      }
      if (planet.ring) {
        poleWorld.set(0, 1, 0).applyQuaternion(orientation);
        const u = planet.ring.uniforms;
        const pole = u.pole?.value;
        if (pole instanceof Vector3) pole.copy(poleWorld);
        u.radius!.value = radius * eq;
        const globe = looks.planets[planet.id].uniforms;
        if (globe.ringPole) {
          const ringPole = globe.ringPole.value;
          if (ringPole instanceof Vector3) ringPole.copy(poleWorld);
          globe.ringRadius!.value = radius * eq;
        }
      }
      const inFrame = grown > 0.02 && el.a > dist * 0.04 && el.a < dist * 0.92;
      const anchor = rulers.anchor(planet.id);
      anchor.x = tmp[0];
      anchor.y = tmp[1];
      anchor.z = tmp[2];
      anchor.on = inFrame;
      const touch = Math.max(planet.id === "saturn" ? r * 2.45 : r, pxWorld(dist, 22), 0.05);
      planet.hit.scale.setScalar(touch);
      const selected = sel?.kind === "planet" && sel.id === planet.id;
      const { orbit } = planet;
      const draw =
        grown > 0.02 && orbitInView(el, show.elliptical, dist, selected) && !hidesFor(planet.id);
      orbit.line.visible = draw;
      if (draw) {
        orbit.update(el, show.elliptical);
        orbit.material.color.set(selected ? GOLD : ORBIT_COLOR[planet.id]);
        orbit.material.opacity = selected ? 0.95 : 0.62;
      }
      place(planet.id, tmp[0], tmp[1], tmp[2], show.names && inFrame && !hidesFor(planet.id));
    }
  };

  const updateNamed = ({ now, show, sel, yearsAgo, mig, driftYears, dist, present }: Frame) => {
    for (const { body, mesh, orbit } of named) {
      const el = namedElements(body, mig, driftYears, now);
      keplerPosition(el, tmp);
      mesh.position.set(tmp[0], tmp[1], tmp[2]);
      const selected = sel?.kind === "named" && sel.id === body.id;
      const eraOk = (rewinds(body.id) && SUN_BIRTH - yearsAgo > 1e6) || present;
      const halleyOk = body.id !== "halley" || show.elliptical || selected;
      const layerOk =
        body.id === "pluto" ? show.kuiper : body.id === "halley" || show.scattered || show.oort;
      /* A close-up keeps its body on whatever the layers say. */
      const on = (eraOk && halleyOk && layerOk) || closeId() === body.id;
      mesh.visible = on;
      const inView = on && orbitInView(el, true, dist, selected);
      const anchor = rulers.anchor(body.id);
      anchor.x = tmp[0];
      anchor.y = tmp[1];
      anchor.z = tmp[2];
      anchor.on = inView;
      const real = body.radiusKm / AU_KM;
      const radius = dotRadius(show, dist, Math.max(real, el.a * 0.08), real, 8);
      mesh.scale.setScalar(radius);
      const host = hosts.get(body.id);
      if (host) {
        host.position.copy(mesh.position);
        host.extent = radius;
        host.on = on;
      }
      if (on) {
        bodyOrientation(body.id, now, mesh.quaternion);
        mesh.geometry = globes.globeFor(mesh.position, radius, globes.small);
      }
      const ellipse = body.id === "halley" ? true : show.elliptical;
      const draw = on && orbitInView(el, ellipse, dist, selected) && !hidesFor(body.id);
      orbit.line.visible = draw;
      if (draw) orbit.update(el, ellipse);
      place(body.id, tmp[0], tmp[1], tmp[2], show.names && inView && !hidesFor(body.id));
    }
  };

  return {
    planets,
    named,
    pickables: [...planets.map((p) => p.hit), ...named.map((n) => n.mesh)],
    update(f: Frame) {
      updatePlanets(f);
      updateNamed(f);
    },
  };
}
