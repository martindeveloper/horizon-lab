/** The sky that rides with the camera, and the presolar cloud before the Sun exists. */
import { Color, Group, Points, type Object3D } from "three";

import { clamp } from "@horizon/toolkit/math";

import {
  catalogueStars,
  createMilkyWay,
  fieldStars,
  galacticPhase,
  skyEpoch,
  starMaterial,
} from "../graphics/sky";
import { SUN_BIRTH } from "../model/parameters";
import { sunExists } from "../model/timeline";
import { molecularCloud } from "./geometry";
import type { Frame, SceneKit } from "./kit";

const TAU = Math.PI * 2;

export function createSkyLayer(
  { scope, looks, camera, tight, dpr }: SceneKit,
  parent: Object3D,
  yearsAgo: number,
) {
  /* A band sphere, the real bright stars, a field. */
  const sky = new Group();
  const milkyWay = scope.own(createMilkyWay(dpr, tight ? 12000 : 30000));
  const fieldMaterial = scope.own(starMaterial(dpr));
  const field = new Points(scope.own(fieldStars(tight ? 900 : 1600)), fieldMaterial);
  field.renderOrder = -3;
  field.frustumCulled = false;
  const brightMaterial = scope.own(starMaterial(dpr));
  const bright = new Points(scope.own(catalogueStars()), brightMaterial);
  bright.renderOrder = -2;
  bright.frustumCulled = false;
  sky.add(milkyWay.group, field, bright);
  parent.add(sky);

  const cloud = new Points(scope.own(molecularCloud(1800)), looks.cloud);
  cloud.frustumCulled = false;
  parent.add(cloud);

  let cloudSpin = 0;
  /** Displayed orbital phase of the Milky Way; eased so playback does not whirl the sky. */
  let skyPhase = galacticPhase(yearsAgo);
  /** True while the Milky Way is still easing toward the true orbital phase. */
  let easing = false;

  return {
    get easing() {
      return easing;
    },
    update(f: Frame, solarRealm: boolean) {
      sky.visible = solarRealm;
      /* The dense natal cloud only exists in the last few million years before collapse. */
      const natal = sunExists(f.yearsAgo) ? 0 : clamp(1 - (f.yearsAgo - SUN_BIRTH) / 4e6, 0, 1);
      cloud.visible = solarRealm && natal > 0.01;
      if (sky.visible) {
        sky.position.copy(camera.position);
        sky.scale.setScalar(Math.max(12, f.dist * 20));
        const epoch = skyEpoch(f.yearsAgo);
        /* Playback turns the Sun's galactic phase about once a second, which would spin the
           whole sky into a strobe. Follow it slowly while playing; otherwise ease to the true
           phase quickly. The phase is unwrapped, so the sky always turns the way time moves,
           never more than one lap: taking the shorter way round flips direction every half
           lap whenever the true phase outruns the follow rate. */
        const target = galacticPhase(f.yearsAgo);
        const ahead = target - skyPhase;
        const gap = Math.sign(ahead) * (Math.abs(ahead) % TAU);
        if (gap !== ahead) skyPhase = target - gap;
        const step = (f.playing ? 0.08 : 6) * f.dt;
        skyPhase += Math.abs(gap) <= step ? gap : Math.sign(gap) * step;
        easing = Math.abs(gap) > step;
        milkyWay.set(skyPhase, epoch.era, epoch.dim, epoch.cloud);
        brightMaterial.uniforms.fade!.value = epoch.real * epoch.dim;
        const brightTint = brightMaterial.uniforms.tint?.value;
        if (brightTint instanceof Color) brightTint.copy(milkyWay.tint);
        fieldMaterial.uniforms.fade!.value = epoch.dim;
        const fieldTint = fieldMaterial.uniforms.tint?.value;
        if (fieldTint instanceof Color) fieldTint.copy(milkyWay.tint);
      }
      if (cloud.visible) {
        if (f.show.drift) cloudSpin += f.dt * 0.02;
        cloud.rotation.y = cloudSpin;
        cloud.scale.setScalar(Math.max(8, f.dist * 2.6));
        looks.cloud.size = f.dist * 0.3;
        looks.cloud.opacity = 0.075 * natal;
      }
    },
  };
}
