/**
 * The Galaxy map: today's spiral, the Sun and the path it came by, the halo. The model is in
 * light-years; its group sits in the scene's au world, turned into the galactic frame with the
 * Sun at the origin. Among the nearest stars, seen from inside, it is the Milky Way band; the
 * Sun's path and the rulers come in as the camera pulls out into the disk. It draws in a pass
 * of its own (`GALAXY_LAYER`).
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

import {
  ownedLine,
  SOLAR_GOLD,
  STRONG,
  type AnchoredRulers,
  type DistanceText,
  type PlaceLabel,
} from "@horizon/toolkit/scene";
import { LIGHT_YEAR_AU, convert } from "@horizon/toolkit/science";

import { modernGalaxy } from "../graphics/galaxy";
import { writeSunTrail } from "../model/galactic-orbit";
import { HALO_R200_KPC } from "../model/parameters";
import type { WorldFrame as Frame, WorldSelection as Selection } from "../show";
import { GALAXY_FRAME, GALAXY_LAYER, LY, SUN_ANCHOR, galaxyToWorld } from "./frames";
import type { GalaxyKit } from "./kit";
import type { LabelPicks } from "./label-picks";

/** Farthest the drawn Galaxy reaches from its centre (ly), halo included. */
const EXTENT_LY = 660_000;

export function createGalaxyLayer(
  { scope, looks, camera, pxWorld, lod }: GalaxyKit,
  parent: Object3D,
  deps: {
    place: PlaceLabel;
    rulers: AnchoredRulers;
    distanceText: DistanceText;
    picks: LabelPicks;
  },
) {
  const { place, rulers, distanceText } = deps;
  /* The Sun's name in the Galaxy opens its card there. */
  deps.picks.register(new Map<string, Selection>([["galaxySun", { kind: "galaxy", id: "sun" }]]));
  const galaxy = new Group();
  galaxy.quaternion.copy(GALAXY_FRAME);
  galaxy.scale.setScalar(LY);
  parent.add(galaxy);
  const modern = modernGalaxy(24_000);
  const today = new Points(scope.own(modern.stars), looks.galaxyToday);
  const dust = new Points(scope.own(modern.dust), looks.galaxyDust);
  today.frustumCulled = false;
  dust.frustumCulled = false;
  /* Dust darkens the stars behind it, so it draws after them. */
  dust.renderOrder = 1;
  const core = new Sprite(looks.galaxyCore);
  core.scale.set(15_000, 15_000, 1);
  const heart = new Sprite(looks.galaxyHeart);
  heart.scale.set(4_600, 4_600, 1);
  const trail = ownedLine(scope, SOLAR_GOLD, 0.9);
  writeSunTrail(trail.positions);
  const sun = new Mesh(scope.own(new SphereGeometry(420, 16, 16)), looks.galaxySunBody);
  const sunGlow = new Sprite(looks.galaxySun);
  sunGlow.scale.set(2_200, 2_200, 1);
  sun.add(sunGlow);
  /* A finger-sized target around the few-pixel Sun. */
  const sunHit = new Mesh(scope.own(new SphereGeometry(1, 8, 6)), looks.ghost);
  sunHit.userData.pick = { kind: "galaxy", id: "sun" } satisfies Selection;
  const bulgeHit = new Mesh(scope.own(new SphereGeometry(3_200, 16, 12)), looks.ghost);
  bulgeHit.userData.pick = { kind: "galaxy", id: "bulge" } satisfies Selection;
  /** Dark-matter halo out to R₂₀₀ (~200 kpc, Bland-Hawthorn & Gerhard 2016). */
  /* The halo is a boundary drawn as a surface: annotation, which the drift's veil fades with the lines. */
  const halo = new Mesh(
    scope.own(new SphereGeometry(convert(HALO_R200_KPC, "kpc", "ly"), 24, 14)),
    looks.halo,
  );
  halo.userData.annotation = true;
  const diskHit = new Mesh(scope.own(new RingGeometry(48_000, 52_000, 64)), looks.ghost);
  diskHit.rotation.x = Math.PI / 2;
  diskHit.userData.pick = { kind: "galaxy", id: "milkyway" } satisfies Selection;
  galaxy.add(today, dust, core, heart, trail.line, sun, sunHit, bulgeHit, halo, diskHit);
  /* The Sun stands at today's place in the model: the scene's origin. */
  sun.position.set(SUN_ANCHOR[0], SUN_ANCHOR[1], SUN_ANCHOR[2]);
  sunHit.position.copy(sun.position);
  galaxy.position.copy(galaxyToWorld(0, 0, 0, new Vector3()));
  galaxy.traverse((object) => object.layers.set(GALAXY_LAYER));

  /* Base opacities, scaled by the handoff and the switches each frame. */
  const base = {
    today: looks.galaxyToday.opacity,
    dust: looks.galaxyDust.opacity,
    heart: looks.galaxyHeart.opacity,
    sun: looks.galaxySun.opacity,
    halo: looks.halo.opacity,
    trail: trail.material.opacity,
  };
  const haloOn = lod.fader();
  const names = lod.fader();
  const at = galaxyToWorld(SUN_ANCHOR[0], SUN_ANCHOR[1], SUN_ANCHOR[2], new Vector3());
  const centre = galaxy.position;

  return {
    pickables: [sunHit, bulgeHit, diskHit],
    get visible() {
      return galaxy.visible;
    },
    /** Camera distance to the far side of everything drawn, au: the Galaxy pass's far plane. */
    reach() {
      return camera.position.distanceTo(centre) + EXTENT_LY * LY;
    },
    update({ show, dist, galaxyPresence = 1 }: Frame) {
      /* The band of our own sky up close, the disk farther out, then one galaxy of many. */
      const shown = (1 - lod.cosmos) * galaxyPresence;
      /* The Sun's path, its marker's name and rulers belong to the Galaxy's scale. */
      const near = lod.galaxy * shown;
      const labelled = names.to(show.names);
      galaxy.visible = shown > 0.001;
      if (!galaxy.visible) {
        place("galaxySun", 0, 0, 0, false);
        return;
      }
      looks.galaxyToday.opacity = base.today * shown;
      looks.galaxyDust.opacity = base.dust * shown;
      looks.galaxyCore.opacity = 0.62 * shown;
      looks.galaxyHeart.opacity = base.heart * shown;
      const haloShown = haloOn.to(show.halo);
      halo.visible = haloShown > 0.004;
      looks.halo.opacity = base.halo * shown * haloShown;

      /* A steady few pixels at any zoom (its glow scales with it). */
      const toSun = camera.position.distanceTo(at);
      sun.scale.setScalar((pxWorld(toSun, 4.5) * shown) / LY / 420);
      sunHit.scale.setScalar(pxWorld(toSun, 22) / LY);
      looks.galaxySun.opacity = base.sun * shown;
      trail.line.visible = near > 0.004;
      trail.material.opacity = base.trail * near;
      if (show.distances && lod.realm === "galaxy") {
        const ly = Math.hypot(SUN_ANCHOR[0], SUN_ANCHOR[1], SUN_ANCHOR[2]);
        rulers.draw(
          at.x,
          at.y,
          at.z,
          centre.x,
          centre.y,
          centre.z,
          distanceText(ly * LIGHT_YEAR_AU),
          0,
          pxWorld(dist, 5),
        );
      }
      place("galaxySun", at.x, at.y, at.z, labelled * near, STRONG);
    },
  };
}
