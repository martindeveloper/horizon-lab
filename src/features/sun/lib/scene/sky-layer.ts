/**
 * The sky behind the Sun: the bright stars of the shared catalogue at their real directions
 * and the painted Milky Way band with its grains and a faint field, the same sky the Orrery
 * carries, turned into the lab's frame (`sky-frame.ts`) and centred on the camera. Its subdued
 * presence is illustrative rather than a physical camera exposure; the eclipse reveals a
 * little more. At zero the layer is hidden and costs no draw.
 */
import { Group, Points, type Object3D, type PerspectiveCamera } from "three";

import { createBrightSky } from "@/space/bright-stars";
import {
  BRIGHT_STAR_LOOK,
  createMilkyWay,
  fieldStars,
  type SkyCounts,
} from "@/space/sky/milky-way";
import { starMaterial } from "@/space/sky/stars";
import { galacticAngle } from "@/space/solar-system/model/equations";
import type { DisposalScope } from "@horizon/toolkit/rendering";

import { ORBIT_REACH_R } from "../parameters";
import { skyOrientation } from "./sky-frame";

/** The sky sphere's radius, radii: centred on the camera, inside the far plane everywhere. */
const SKY_RADIUS_R = ORBIT_REACH_R;

export function createSkyLayer(
  scope: DisposalScope,
  parent: Object3D,
  dpr: { value: number },
  counts: SkyCounts,
  wake: () => void,
) {
  const sky = new Group();
  sky.quaternion.copy(skyOrientation());
  sky.scale.setScalar(SKY_RADIUS_R);
  const milkyWay = scope.own(
    createMilkyWay(counts.milkyWay, { grain: () => starMaterial(dpr), eras: "today", wake }),
  );
  const fieldMaterial = scope.own(starMaterial(dpr));
  const field = new Points(fieldStars(counts.fieldStars), fieldMaterial);
  field.renderOrder = -3;
  field.frustumCulled = false;
  scope.defer(() => field.geometry.dispose());
  const brightMaterial = scope.own(starMaterial(dpr));
  const bright = createBrightSky(scope, brightMaterial, BRIGHT_STAR_LOOK);
  sky.add(milkyWay.group, field, bright);
  parent.add(sky);
  /* Today's sky: the Sun's galactic orbital phase now, the thin disk, no reddening. */
  const phase = galacticAngle.compute({ t: 0 });
  let drawn = counts;
  let shown = -1;

  return {
    /** Resamples the Milky Way's grains and the field stars at a new quality's counts. */
    setCounts(next: SkyCounts) {
      if (next.milkyWay !== drawn.milkyWay) milkyWay.setGrains(next.milkyWay);
      if (next.fieldStars !== drawn.fieldStars) {
        field.geometry.dispose();
        field.geometry = fieldStars(next.fieldStars);
      }
      drawn = next;
    },
    /** Each frame: on the camera, as bright as the light shows it (0 hides the layer). */
    update(camera: PerspectiveCamera, exposure: number) {
      sky.visible = exposure > 0;
      if (!sky.visible) return;
      sky.position.copy(camera.position);
      if (exposure === shown) return;
      shown = exposure;
      milkyWay.set(phase, 1, exposure, 0);
      fieldMaterial.uniforms.fade!.value = exposure;
      brightMaterial.uniforms.fade!.value = exposure;
    },
  };
}
