/** The Sun, the young gas disk with its snow line, and the ecliptic grid. */
import { CircleGeometry, LineSegments, Mesh, Sprite, type Object3D } from "three";

import { bodyOrientation } from "../graphics/coordinates";
import { MODEL_START, GAS_DISK_RADIUS_AU, SNOW_LINE_AU } from "../model/parameters";
import { gasDiskFade } from "../model/timeline";
import type { Selection } from "../store";
import { SEG, ownedLine, polarGrid, type Globes } from "./geometry";
import { SUN_R, type Frame, type HidesFor, type SceneKit } from "./kit";
import { BELOW, STRONG, type PlaceLabel } from "./labels";

export function createSunLayer(
  { scope, looks, pxWorld }: SceneKit,
  parent: Object3D,
  globes: Globes,
  place: PlaceLabel,
  hidesFor: HidesFor,
) {
  const gasDisk = new Mesh(scope.own(new CircleGeometry(GAS_DISK_RADIUS_AU, 72)), looks.gasDisk);
  gasDisk.rotation.x = -Math.PI / 2;
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

  const sun = new Mesh(globes.sphere, looks.sun);
  sun.userData.pick = { kind: "sun" } satisfies Selection;
  const glow = new Sprite(looks.sunGlow);
  const corona = new Sprite(looks.sunCorona);
  parent.add(sun, glow, corona);

  return {
    sun,
    update({ yearsAgo, dist, show, now }: Frame) {
      const forming = yearsAgo > MODEL_START;
      const gas = 1 - gasDiskFade(yearsAgo);
      gasDisk.visible = forming && gas > 0.01;
      looks.gasDisk.uniforms.opacity!.value = gas * 0.6;
      snowLine.line.visible = gasDisk.visible && dist < 400;
      snowLine.material.opacity = 0.7 * gas;
      place("snowLine", 0, 0, SNOW_LINE_AU, snowLine.line.visible && show.names, BELOW);
      grid.visible = show.plane && dist < 12_000;
      if (grid.visible) grid.scale.setScalar(dist / 2.6);

      const scale = Math.max(
        show.trueSize ? SUN_R : Math.min(3.2, dist * 0.016, Math.max(SUN_R, pxWorld(dist, 15))),
        SUN_R,
      );
      sun.scale.setScalar(scale);
      bodyOrientation("sun", now, sun.quaternion);
      sun.geometry = globes.globeFor(sun.position, scale);
      const flare = 1 + 1.4 * gas;
      glow.scale.set(scale * 6.2 * flare, scale * 6.2 * flare, 1);
      corona.scale.set(scale * 3.3 * flare, scale * 3.3 * flare, 1);
      place("sun", 0, 0, 0, show.names && dist < 12_000 && !hidesFor("sun"), STRONG);
    },
  };
}
