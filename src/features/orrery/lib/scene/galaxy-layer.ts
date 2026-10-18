/**
 * The Galaxy map: today's spiral or the young disk, the Sun's orbit and its trail, the halo.
 * The model is in light-years; its group sits in the scene's au world, turned into the
 * galactic frame with the Sun (or its birthplace) at the origin, and fades in over the
 * handoff from the solar map. It draws in a pass of its own (`GALAXY_LAYER`).
 */
import {
  Group,
  Mesh,
  Points,
  RingGeometry,
  SphereGeometry,
  Sprite,
  Vector3,
  type Object3D,
} from "three";

import { LIGHT_YEAR_AU } from "@horizon/toolkit/science";

import { earlyGalaxy, modernGalaxy } from "../graphics/galaxy";
import { createSunTrailWriter, sunGalactic } from "../model/galactic-orbit";
import { sunExists } from "../model/timeline";
import type { Selection } from "../store";
import { ownedLine } from "./geometry";
import { GOLD, type Frame, type SceneKit } from "./kit";
import { STRONG, type PlaceLabel } from "./labels";
import { GALAXY_FRAME, GALAXY_LAYER, LY, galacticAnchor, galaxyToWorld } from "./lod";
import type { DistanceText, Rulers } from "./rulers";

/** Farthest the drawn Galaxy reaches from its centre (ly), halo included. */
const EXTENT_LY = 660_000;

export function createGalaxyLayer(
  { scope, looks, camera, pxWorld, lod }: SceneKit,
  parent: Object3D,
  deps: { place: PlaceLabel; rulers: Rulers; distanceText: DistanceText },
) {
  const { place, rulers, distanceText } = deps;
  const galaxy = new Group();
  galaxy.quaternion.copy(GALAXY_FRAME);
  galaxy.scale.setScalar(LY);
  parent.add(galaxy);
  const modern = modernGalaxy(24_000);
  const today = new Points(scope.own(modern.stars), looks.galaxyToday);
  const dust = new Points(scope.own(modern.dust), looks.galaxyDust);
  const early = new Points(scope.own(earlyGalaxy(4200)), looks.galaxyEarly);
  today.frustumCulled = false;
  dust.frustumCulled = false;
  early.frustumCulled = false;
  /* Dust darkens the stars behind it, so it draws after them. */
  dust.renderOrder = 1;
  const core = new Sprite(looks.galaxyCore);
  core.scale.set(15_000, 15_000, 1);
  const heart = new Sprite(looks.galaxyHeart);
  heart.scale.set(4_600, 4_600, 1);
  const trail = ownedLine(scope, GOLD, 0.9);
  const updateTrail = createSunTrailWriter(trail.positions);
  let trailCount = 0;
  const sun = new Mesh(scope.own(new SphereGeometry(420, 16, 16)), looks.galaxySunBody);
  const sunGlow = new Sprite(looks.galaxySun);
  sunGlow.scale.set(2_200, 2_200, 1);
  sun.add(sunGlow);
  /* A finger-sized target around the few-pixel Sun. */
  const sunHit = new Mesh(scope.own(new SphereGeometry(1, 8, 6)), looks.ghost);
  sunHit.userData.pick = { kind: "galaxy", id: "sun" } satisfies Selection;
  const bulgeHit = new Mesh(scope.own(new SphereGeometry(3_200, 16, 12)), looks.ghost);
  bulgeHit.userData.pick = { kind: "galaxy", id: "bulge" } satisfies Selection;
  /** Dark-matter halo out to roughly R₂₀₀ ≈ 200 kpc (virial radius ~280 kpc, Bland-Hawthorn & Gerhard 2016). */
  const halo = new Mesh(scope.own(new SphereGeometry(650_000, 24, 14)), looks.halo);
  const diskHit = new Mesh(scope.own(new RingGeometry(48_000, 52_000, 64)), looks.ghost);
  diskHit.rotation.x = Math.PI / 2;
  diskHit.userData.pick = { kind: "galaxy", id: "milkyway" } satisfies Selection;
  galaxy.add(today, dust, early, core, heart, trail.line, sun, sunHit, bulgeHit, halo, diskHit);
  galaxy.traverse((object) => object.layers.set(GALAXY_LAYER));

  /* Base opacities, scaled by the handoff and the switches each frame. */
  const base = {
    today: looks.galaxyToday.opacity,
    early: looks.galaxyEarly.opacity,
    dust: looks.galaxyDust.opacity,
    heart: looks.galaxyHeart.opacity,
    sun: looks.galaxySun.opacity,
    halo: looks.halo.opacity,
    trail: trail.material.opacity,
  };
  const young = lod.fader(0.8);
  const haloOn = lod.fader();
  const names = lod.fader();
  const anchor: [number, number, number] = [0, 0, 0];
  const at = new Vector3();
  const centre = new Vector3();
  const tmp: [number, number, number] = [0, 0, 0];

  return {
    pickables: [sunHit, bulgeHit, diskHit],
    get visible() {
      return galaxy.visible;
    },
    /** Camera distance to the far side of everything drawn, au: the Galaxy pass's far plane. */
    reach() {
      return camera.position.distanceTo(centre) + EXTENT_LY * LY;
    },
    update({ show, yearsAgo, dist }: Frame) {
      const shown = lod.galaxy;
      const labelled = names.to(show.names);
      galaxy.visible = shown > 0.001;
      if (!galaxy.visible) {
        place("galaxySun", 0, 0, 0, false);
        return;
      }
      /* The Sun (or its birthplace) is the scene's origin. */
      galacticAnchor(yearsAgo, show.elliptical, anchor);
      galaxyToWorld(0, 0, 0, anchor, centre);
      galaxy.position.copy(centre);
      const past = young.to(!sunExists(yearsAgo));
      today.visible = dust.visible = past < 0.999;
      early.visible = past > 0.001;
      looks.galaxyToday.opacity = base.today * shown * (1 - past);
      looks.galaxyDust.opacity = base.dust * shown * (1 - past);
      looks.galaxyEarly.opacity = base.early * shown * past;
      looks.galaxyCore.opacity = (0.62 - 0.34 * past) * shown;
      looks.galaxyHeart.opacity = base.heart * shown;
      const haloShown = haloOn.to(show.halo) * (1 - past);
      halo.visible = haloShown > 0.004;
      looks.halo.opacity = base.halo * shown * haloShown;

      const pos = sunGalactic(yearsAgo, show.elliptical, tmp);
      sun.visible = !!pos;
      sunHit.visible = !!pos;
      if (pos) {
        sun.position.set(pos[0], pos[1], pos[2]);
        sunHit.position.copy(sun.position);
        /* A steady few pixels at any zoom (its glow scales with it), grown in by the handoff. */
        galaxyToWorld(pos[0], pos[1], pos[2], anchor, at);
        const toSun = camera.position.distanceTo(at);
        sun.scale.setScalar((pxWorld(toSun, 4.5) * shown) / LY / 420);
        sunHit.scale.setScalar(pxWorld(toSun, 22) / LY);
        looks.galaxySun.opacity = base.sun * shown;
      }
      const count = updateTrail(yearsAgo, show.elliptical);
      if (count !== null) {
        trailCount = count;
        trail.geometry.setDrawRange(0, count);
        trail.geometry.getAttribute("position").needsUpdate = true;
      }
      trail.line.visible = !!pos && trailCount > 2;
      trail.material.opacity = base.trail * shown;
      if (show.distances && pos && lod.realm === "galaxy") {
        const ly = Math.hypot(pos[0], pos[1], pos[2]);
        const text = distanceText(ly * LIGHT_YEAR_AU);
        rulers.draw(at.x, at.y, at.z, centre.x, centre.y, centre.z, text, 0, pxWorld(dist, 5));
      }
      place("galaxySun", at.x, at.y, at.z, labelled * shown * (pos ? 1 : 0), STRONG);
    },
  };
}
