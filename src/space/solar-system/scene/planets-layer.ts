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
import {
  bodyOrientation,
  framed,
  SOLAR_GOLD,
  type AnchoredRulers,
  type PlaceLabel,
} from "@horizon/toolkit/scene";
import { AU_KM } from "@horizon/toolkit/science";

import { namedElements, planetElements, rewinds } from "../model/elements";
import { planetGrowth } from "../model/moment";
import { SUN_BIRTH } from "../model/parameters";
import type { SolarSelection } from "../model/selection";
import { orbitOf, type Globes } from "./geometry";
import {
  COMET_ORBIT_COLOR,
  ORBIT_COLOR,
  SMALL_ORBIT_COLOR,
  type ShownFor,
  type SolarFrame,
  type SolarKit,
  type SolarShow,
} from "./kit";
import { orbitShown } from "./lod";
import type { MoonHosts } from "./moons-layer";

/** Equatorial and polar radius over the mean radius: the giants' oblate figures. */
const shapeOf = (id: BodyId) =>
  [
    FIGURES[id].equatorialKm / FIGURES[id].meanKm,
    FIGURES[id].polarKm / FIGURES[id].meanKm,
  ] as const;

export function createPlanetsLayer(
  kit: SolarKit,
  parent: Object3D,
  deps: {
    globes: Globes;
    place: PlaceLabel;
    rulers: AnchoredRulers;
    hosts: MoonHosts;
    shownFor: ShownFor;
    /** The body in close-up, which stays drawn whatever the layers say. */
    closeId: () => BodyId | null;
  },
) {
  const { scope, looks, pxWorld, lod } = kit;
  const { globes, place, rulers, hosts, shownFor, closeId } = deps;
  const names = lod.fader();
  const dotRadius = (show: SolarShow, dist: number, cap: number, real: number, px: number) =>
    show.trueSize ? real : Math.min(cap, Math.max(real, pxWorld(dist, px)));

  const planets = PLANET_IDS.map((id) => {
    const group = new Group();
    const body = new Mesh(globes.sphere, looks.planets[id]);
    const hit = new Mesh(globes.hit, looks.ghost);
    hit.userData.pick = { kind: "planet", id } satisfies SolarSelection;
    hit.userData.globe = body;
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
    mesh.userData.pick = { kind: "named", id: body.id } satisfies SolarSelection;
    mesh.userData.globe = mesh;
    if (body.id === "halley") {
      const coma = new Sprite(looks.halleyComa);
      coma.scale.set(4.2, 4.2, 1);
      mesh.add(coma);
    }
    parent.add(mesh);
    const orbit = orbitOf(scope, body.id === "halley" ? COMET_ORBIT_COLOR : SMALL_ORBIT_COLOR, 0.7);
    /* Layer switches and eras grow the marker in and out rather than popping it. */
    return { body, mesh, orbit, on: lod.fader() };
  });
  for (const slot of [...planets, ...named]) parent.add(slot.orbit.line);

  const tmp: [number, number, number] = [0, 0, 0];
  const orientation = new Quaternion();
  const poleWorld = new Vector3();

  const updatePlanets = ({ now, show, sel, yearsAgo, mig, driftYears, dist }: SolarFrame) => {
    const labelled = names.to(show.names);
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
      globes.fit(planet.body, planet.group.position, radius * eq);
      if (planet.group.visible) lod.see(planet.id, lod.px(radius * eq, planet.group.position));
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
      const present = grown > 0.02 ? 1 : 0;
      const shown = shownFor(planet.id);
      const inFrame = present * framed(el.a, el.a, dist);
      const anchor = rulers.anchor(planet.id);
      anchor.x = tmp[0];
      anchor.y = tmp[1];
      anchor.z = tmp[2];
      anchor.on = inFrame > 0.5;
      const touch = Math.max(planet.id === "saturn" ? r * 2.45 : r, pxWorld(dist, 22), 0.05);
      planet.hit.scale.setScalar(touch);
      const selected = sel?.kind === "planet" && sel.id === planet.id;
      const { orbit } = planet;
      const drawn = present * shown * (selected ? 1 : orbitShown(el, show.elliptical, dist));
      orbit.line.visible = drawn > 0.004;
      if (orbit.line.visible) {
        orbit.update(el, show.elliptical);
        orbit.material.color.set(selected ? SOLAR_GOLD : ORBIT_COLOR[planet.id]);
        orbit.material.opacity = (selected ? 0.95 : 0.62) * drawn;
      }
      place(planet.id, tmp[0], tmp[1], tmp[2], labelled * inFrame * shown);
    }
  };

  const updateNamed = ({
    now,
    show,
    sel,
    yearsAgo,
    mig,
    driftYears,
    dist,
    present,
  }: SolarFrame) => {
    const labelled = names.value;
    for (const { body, mesh, orbit, on } of named) {
      const el = namedElements(body, mig, driftYears, now);
      keplerPosition(el, tmp);
      mesh.position.set(tmp[0], tmp[1], tmp[2]);
      const selected = sel?.kind === "named" && sel.id === body.id;
      const eraOk = (rewinds(body.id) && SUN_BIRTH - yearsAgo > 1e6) || present;
      const halleyOk = body.id !== "halley" || show.elliptical || selected;
      const layerOk =
        body.id === "pluto" ? show.kuiper : body.id === "halley" || show.scattered || show.oort;
      /* A close-up keeps its body on whatever the layers say. */
      const grow = on.to((eraOk && halleyOk && layerOk) || closeId() === body.id);
      mesh.visible = grow > 0.001;
      const ellipse = body.id === "halley" ? true : show.elliptical;
      const inView = grow * (selected ? 1 : orbitShown(el, true, dist));
      const anchor = rulers.anchor(body.id);
      anchor.x = tmp[0];
      anchor.y = tmp[1];
      anchor.z = tmp[2];
      anchor.on = inView > 0.5;
      const real = body.radiusKm / AU_KM;
      const radius = dotRadius(show, dist, Math.max(real, el.a * 0.08), real, 8);
      mesh.scale.setScalar(radius * grow);
      const host = hosts.get(body.id);
      if (host) {
        host.position.copy(mesh.position);
        host.extent = radius * grow;
        host.on = grow > 0.5;
      }
      if (mesh.visible) {
        bodyOrientation(body.id, now, mesh.quaternion);
        globes.fit(mesh, mesh.position, radius, globes.small);
        lod.see(body.id, lod.px(radius * grow, mesh.position));
      }
      const shown = shownFor(body.id);
      const drawn = grow * shown * (selected ? 1 : orbitShown(el, ellipse, dist));
      orbit.line.visible = drawn > 0.004;
      if (orbit.line.visible) {
        orbit.update(el, ellipse);
        orbit.material.opacity = 0.7 * drawn;
      }
      place(body.id, tmp[0], tmp[1], tmp[2], labelled * inView * shown);
    }
  };

  return {
    planets,
    named,
    pickables: [...planets.map((p) => p.hit), ...named.map((n) => n.mesh)],
    update(f: SolarFrame) {
      updatePlanets(f);
      updateNamed(f);
    },
  };
}
