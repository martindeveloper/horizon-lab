/** The Sun, the young gas disk with its snow line, and the ecliptic grid. */
import { CircleGeometry, LineSegments, Mesh, Sprite, type Object3D } from "three";

import { bodyOrientation } from "../graphics/coordinates";
import { MODEL_START, GAS_DISK_RADIUS_AU, SNOW_LINE_AU } from "../model/parameters";
import { gasDiskFade } from "../model/timeline";
import type { Selection } from "../store";
import { SEG, ownedLine, polarGrid, type Globes } from "./geometry";
import { SUN_R, type Frame, type SceneKit, type ShownFor } from "./kit";
import { BELOW, STRONG, type PlaceLabel } from "./labels";
import { fade } from "./lod";

/** Where the snow line, the grid and the Sun's name read (camera distance, au). */
const SNOW = fade(0, 0, 280, 560);
const GRID = fade(0, 0, 8_000, 16_000);
const NAME = fade(0, 0, 8_000, 16_000);

export function createSunLayer(
  { scope, looks, pxWorld, lod }: SceneKit,
  parent: Object3D,
  globes: Globes,
  place: PlaceLabel,
  shownFor: ShownFor,
) {
  const gasDisk = new Mesh(scope.own(new CircleGeometry(GAS_DISK_RADIUS_AU, 72)), looks.gasDisk);
  gasDisk.rotation.x = -Math.PI / 2;
  gasDisk.renderOrder = -1;
  parent.add(gasDisk);

  /* The snow line: beyond it water ice condenses beside rock and metal. */
  const snowLine = ownedLine(scope, 0xa8d4ec, 0.7, SEG);
  for (let k = 0; k <= SEG; k += 1) {
    const angle = (k / SEG) * Math.PI * 2;
    snowLine.positions[k * 3] = SNOW_LINE_AU * Math.cos(angle);
    snowLine.positions[k * 3 + 2] = SNOW_LINE_AU * Math.sin(angle);
  }
  snowLine.line.visible = false;
  parent.add(snowLine.line);

  const grid = new LineSegments(scope.own(polarGrid()), looks.grid);
  parent.add(grid);
  const gridOpacity = looks.grid.opacity;
  const plane = lod.fader();
  const names = lod.fader();

  const sun = new Mesh(globes.sphere, looks.sun);
  sun.userData.pick = { kind: "sun" } satisfies Selection;
  const glow = new Sprite(looks.sunGlow);
  parent.add(sun, glow);

  return {
    sun,
    update({ yearsAgo, dist, show, now }: Frame) {
      const forming = yearsAgo > MODEL_START;
      const gas = 1 - gasDiskFade(yearsAgo);
      gasDisk.visible = forming && gas > 0.01;
      looks.gasDisk.uniforms.opacity!.value = gas * 0.6;
      const snow = gasDisk.visible ? SNOW(dist) * gas : 0;
      snowLine.line.visible = snow > 0.004;
      snowLine.material.opacity = 0.7 * snow;
      const labelled = names.to(show.names);
      place("snowLine", 0, 0, SNOW_LINE_AU, labelled * snow, BELOW);
      const gridShown = GRID(dist) * plane.to(show.plane);
      grid.visible = gridShown > 0.004;
      looks.grid.opacity = gridOpacity * gridShown;
      if (grid.visible) grid.scale.setScalar(dist / 2.6);

      const scale = Math.max(
        show.trueSize ? SUN_R : Math.min(3.2, dist * 0.016, Math.max(SUN_R, pxWorld(dist, 15))),
        SUN_R,
      );
      sun.scale.setScalar(scale);
      bodyOrientation("sun", now, sun.quaternion);
      globes.fit(sun, sun.position, scale);
      lod.see("sun", lod.px(scale, sun.position));
      const flare = 1 + 1.4 * gas;
      glow.scale.set(scale * 2.8 * flare, scale * 2.8 * flare, 1);
      place("sun", 0, 0, 0, labelled * NAME(dist) * shownFor("sun"), STRONG);
    },
  };
}
