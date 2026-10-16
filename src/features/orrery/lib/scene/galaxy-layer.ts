/** The Galaxy map: today's spiral or the young disk, the Sun's orbit and its trail, the halo. */
import { Group, Mesh, Points, RingGeometry, SphereGeometry, Sprite, type Object3D } from "three";

import { LIGHT_YEAR_AU } from "@horizon/toolkit/science";

import { earlyGalaxy, modernGalaxy } from "../graphics/galaxy";
import { createSunTrailWriter, sunGalactic } from "../model/galactic-orbit";
import { sunExists } from "../model/timeline";
import type { Selection } from "../store";
import { ownedLine } from "./geometry";
import { GOLD, type Frame, type SceneKit } from "./kit";
import { STRONG, type PlaceLabel } from "./labels";
import type { DistanceText, Rulers } from "./rulers";

export function createGalaxyLayer(
  { scope, looks, camera, pxWorld }: SceneKit,
  parent: Object3D,
  deps: { place: PlaceLabel; rulers: Rulers; distanceText: DistanceText },
) {
  const { place, rulers, distanceText } = deps;
  const galaxy = new Group();
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
  const tmp: [number, number, number] = [0, 0, 0];

  return {
    pickables: [sunHit, bulgeHit, diskHit],
    update({ show, yearsAgo, dist }: Frame, visible: boolean) {
      galaxy.visible = visible;
      if (!visible) {
        place("galaxySun", 0, 0, 0, false);
        return;
      }
      const young = !sunExists(yearsAgo);
      today.visible = !young;
      dust.visible = !young;
      early.visible = young;
      looks.galaxyCore.opacity = young ? 0.28 : 0.62;
      const pos = sunGalactic(yearsAgo, show.elliptical, tmp);
      sun.visible = !!pos;
      sunHit.visible = !!pos;
      if (pos) {
        sun.position.set(pos[0], pos[1], pos[2]);
        sunHit.position.copy(sun.position);
        /* A steady few pixels at any zoom, so it never swells into a ball near the seam. */
        const toSun = camera.position.distanceTo(sun.position);
        sun.scale.setScalar(pxWorld(toSun, 4.5) / 420);
        sunHit.scale.setScalar(pxWorld(toSun, 22));
      }
      const count = updateTrail(yearsAgo, show.elliptical);
      if (count !== null) {
        trailCount = count;
        trail.geometry.setDrawRange(0, count);
        trail.geometry.getAttribute("position").needsUpdate = true;
      }
      trail.line.visible = !!pos && trailCount > 2;
      halo.visible = show.halo && !young;
      if (show.distances && pos) {
        const ly = Math.hypot(pos[0], pos[1], pos[2]);
        const text = distanceText(ly * LIGHT_YEAR_AU);
        rulers.draw(pos[0], pos[1], pos[2], 0, 0, 0, text, 0, pxWorld(dist, 5));
      }
      rulers.finish();
      const [x, y, z] = pos ?? [0, 0, 0];
      place("galaxySun", x, y, z, show.names && !!pos, STRONG);
    },
  };
}
