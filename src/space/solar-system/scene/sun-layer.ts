/**
 * The Sun, the young gas disk with its snow line, and the ecliptic grid. Before the first solids
 * the Sun is a protostar (model/formation.ts): an ember through its dust that whitens as it
 * grows, its first disk small and growing out to the painted one.
 */
import { CircleGeometry, Color, LineSegments, Mesh, Sprite, type Object3D } from "three";

import { lerp } from "@horizon/toolkit/math";
import {
  BELOW,
  bodyOrientation,
  fade,
  ownedLine,
  type PlaceLabel,
  STRONG,
} from "@horizon/toolkit/scene";

import { protostarPhase } from "../model/formation";
import { gasDiskFade } from "../model/moment";
import { MODEL_START, GAS_DISK_RADIUS_AU, SNOW_LINE_AU } from "../model/parameters";
import type { SolarSelection } from "../model/selection";
import { SEG, polarGrid, type Globes } from "./geometry";
import { SUN_R, type SolarFrame, type SolarKit, type ShownFor } from "./kit";

/** Where the snow line, the grid and the Sun's name read (camera distance, au). */
const SNOW = fade(0, 0, 280, 560);
const GRID = fade(0, 0, 8_000, 16_000);
const NAME = fade(0, 0, 8_000, 16_000);
/** The protostar's glow as it lights: an ember seen through its dust, this much of the full glow. */
const EMBER = new Color("#ff8c46");
const EMBER_LIGHT = 0.5;
const WHITE = new Color("#ffffff");
/** The first disk's radius over the painted one's as the protostar lights: material with more spin arrives later, so the disk grows outward. */
const FIRST_DISK = 0.3;
/** The envelope scatters the newborn star's light: its glow starts this much wider and tightens as the envelope clears. */
const ENVELOPE_FLARE = 2;

export function createSunLayer(
  { scope, looks, pxWorld, lod }: SolarKit,
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
  sun.userData.pick = { kind: "sun" } satisfies SolarSelection;
  sun.userData.globe = sun;
  const glow = new Sprite(looks.sunGlow);
  parent.add(sun, glow);

  return {
    sun,
    update({ yearsAgo, dist, show, now }: SolarFrame) {
      /* 0 as the protostar lights, 1 from the first solids on. */
      const lit = protostarPhase(yearsAgo);
      const forming = yearsAgo > MODEL_START;
      const gas = (1 - gasDiskFade(yearsAgo)) * lit;
      gasDisk.visible = forming && gas > 0.01;
      gasDisk.scale.setScalar(lerp(FIRST_DISK, 1, lit));
      looks.gasDisk.uniforms.opacity!.value = gas * 0.6;
      const snow = gasDisk.visible ? SNOW(dist) * gas : 0;
      snowLine.line.visible = snow > 0.004;
      snowLine.material.opacity = 0.7 * snow;
      const labelled = names.to(show.names);
      place("snowLine", 0, 0, SNOW_LINE_AU, labelled * snow, BELOW);
      /* The plane, and the Sun's name, come with the star. */
      const gridShown = GRID(dist) * plane.to(show.plane) * lit;
      grid.visible = gridShown > 0.004;
      looks.grid.opacity = gridOpacity * gridShown;
      if (grid.visible) grid.scale.setScalar(dist / 2.6);

      const scale = Math.max(
        show.trueSize ? SUN_R : Math.min(3.2, dist * 0.016, Math.max(SUN_R, pxWorld(dist, 15))),
        SUN_R,
      );
      /* The star grows into its glow as it lights. */
      sun.visible = lit > 0.01;
      sun.scale.setScalar(scale * lit);
      bodyOrientation("sun", now, sun.quaternion);
      globes.fit(sun, sun.position, scale * lit);
      lod.see("sun", lod.px(scale * lit, sun.position));
      looks.sunGlow.color.copy(EMBER).multiplyScalar(EMBER_LIGHT).lerp(WHITE, lit);
      const flare = 1 + 1.4 * gas + ENVELOPE_FLARE * (1 - lit);
      glow.scale.set(scale * 2.8 * flare, scale * 2.8 * flare, 1);
      place("sun", 0, 0, 0, labelled * NAME(dist) * shownFor("sun") * lit, STRONG);
    },
  };
}
