/**
 * The sky that rides with the camera, and the presolar cloud before the Sun exists, drawn at
 * the camera's scale about the viewer, with its dense core before them: the core falls in on
 * the centre at the model's pace (model/formation.ts), spinning up and flattening as it
 * shrinks, and hands over to the protostar that lights there, while the cloud around thins
 * away as the star grows.
 */
import { Color, Group, Points, type Object3D } from "three";

import { carrySky, createBrightSky } from "@/space/bright-stars";
import { BRIGHT_STAR_LOOK, type SkyCounts } from "@/space/sky/milky-way";
import { coreRadius } from "@/space/solar-system/model/formation";
import type { SolarFrame, SolarKit } from "@/space/solar-system/scene/kit";
import { TAU } from "@horizon/toolkit/math";

import {
  cloudMaterial,
  createMilkyWay,
  fieldStars,
  galacticPhase,
  molecularCloud,
  natalCloud,
  prestellarCore,
  skyEpoch,
  starMaterial,
} from "../graphics/sky";

/** The sky's turn toward the true galactic phase, rad/s: while time runs, and to a set clock. */
const SKY_FOLLOW = 0.08;
const SKY_SETTLE = 6;
/** Seconds the cloud takes to come up when a set clock lands in it: a jump in time is not a pop. */
const CLOUD_RISES = 1.5;
/** The cloud's reach about the viewer and its grains, in camera distances; the core's, before them. */
const CLOUD_REACH = 2.6;
const CLOUD_GRAIN = 0.3;
const CORE_REACH = 0.7;
const CORE_GRAIN = 0.1;
/** The cloud's turn, rad per second of playback; the core's spins up as 1/r² while it shrinks (angular momentum), capped once it has all but gone. */
const CLOUD_SPIN = 0.02;
const SPIN_FLOOR = 0.2;
/** The envelope left about the newborn star, over the core's radius at rest: it thins away with the cloud as the star grows. */
const ENVELOPE = 0.12;
/** The falling core warms from the cloud's cold light toward an ember's. */
const EMBER = new Color("#ffa060");
const COLD = new Color("#ffffff");

export function createSkyLayer(
  { scope, camera, dpr, invalidate, lod }: SolarKit,
  parent: Object3D,
  yearsAgo: number,
  counts: SkyCounts,
) {
  /* A band sphere, the real bright stars, a field. */
  const sky = new Group();
  const milkyWay = scope.own(createMilkyWay(dpr, counts.milkyWay, invalidate));
  const fieldMaterial = scope.own(starMaterial(dpr));
  const field = new Points(fieldStars(counts.fieldStars), fieldMaterial);
  scope.defer(() => field.geometry.dispose());
  let drawn = counts;
  field.renderOrder = -3;
  field.frustumCulled = false;
  const brightMaterial = scope.own(starMaterial(dpr));
  const bright = createBrightSky(scope, brightMaterial, BRIGHT_STAR_LOOK);
  sky.add(milkyWay.group, field, bright);
  parent.add(sky);

  const cloudLook = scope.own(cloudMaterial());
  const cloud = new Points(scope.own(molecularCloud(1800)), cloudLook);
  cloud.frustumCulled = false;
  /* The core: a dense ball before the viewer, the part that falls. */
  const coreLook = scope.own(cloudMaterial());
  const core = new Points(scope.own(prestellarCore(1400)), coreLook);
  core.frustumCulled = false;
  parent.add(cloud, core);
  const gathered = lod.fader(CLOUD_RISES);

  let cloudSpin = 0;
  let coreSpin = 0;
  /** Displayed orbital phase of the Milky Way; eased so playback does not whirl the sky. */
  let skyPhase = galacticPhase(yearsAgo);
  /** True while the Milky Way is still easing toward the true orbital phase. */
  let easing = false;
  /** The clock the sky last saw, and whether a set clock is still turning it there quickly. */
  let seenYears = yearsAgo;
  let settling = false;

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
    get easing() {
      return easing;
    },
    update(f: SolarFrame) {
      /* The natal cloud only exists in the last few million years before its core falls, and
         thins away, with what is left of the core about the star, as the protostar grows. */
      const radius = Math.max(coreRadius(f.yearsAgo), ENVELOPE);
      const natal = natalCloud(f.yearsAgo) * gathered.to(natalCloud(f.yearsAgo) > 0.01);
      cloud.visible = core.visible = natal > 0.01;
      carrySky(sky, camera, f.dist);
      const epoch = skyEpoch(f.yearsAgo);
      /* Playback turns the Sun's galactic phase about once a second, which would spin the
         whole sky into a strobe, so the sky turns only as time does: it follows the true phase
         slowly while time runs and holds while paused, lagging or not. A clock set while
         paused (a seek, a tour step) is a jump the sky turns to quickly. The phase is
         unwrapped, so the sky always turns the way time moves, never more than one lap:
         taking the shorter way round flips direction every half lap whenever the true phase
         outruns the follow rate. */
      if (f.playing) settling = false;
      else if (f.yearsAgo !== seenYears) settling = true;
      seenYears = f.yearsAgo;
      const target = galacticPhase(f.yearsAgo);
      const ahead = target - skyPhase;
      const gap = Math.sign(ahead) * (Math.abs(ahead) % TAU);
      if (gap !== ahead) skyPhase = target - gap;
      let rate = 0;
      if (settling) rate = SKY_SETTLE;
      else if (f.playing) rate = SKY_FOLLOW;
      const step = rate * f.dt;
      skyPhase += Math.abs(gap) <= step ? gap : Math.sign(gap) * step;
      easing = rate > 0 && Math.abs(gap) > step;
      settling &&= easing;
      const { dim } = epoch;
      milkyWay.set(skyPhase, epoch.era, dim, epoch.cloud);
      brightMaterial.uniforms.fade!.value = epoch.real * dim;
      const brightTint = brightMaterial.uniforms.tint?.value;
      if (brightTint instanceof Color) brightTint.copy(milkyWay.tint);
      fieldMaterial.uniforms.fade!.value = dim;
      const fieldTint = fieldMaterial.uniforms.tint?.value;
      if (fieldTint instanceof Color) fieldTint.copy(milkyWay.tint);
      if (cloud.visible) {
        if (f.playing) cloudSpin += f.dt * CLOUD_SPIN;
        cloud.rotation.y = cloudSpin;
        cloud.scale.setScalar(Math.max(8, f.dist * CLOUD_REACH));
        cloudLook.size = f.dist * CLOUD_GRAIN;
        cloudLook.opacity = 0.075 * natal;
      }
      if (core.visible) {
        if (f.playing) coreSpin += (f.dt * CLOUD_SPIN) / Math.max(radius, SPIN_FLOOR) ** 2;
        core.rotation.y = coreSpin;
        /* The poles fall freely while the spin holds the plane up: the core flattens as it shrinks. */
        const reach = f.dist * CORE_REACH * radius;
        core.scale.set(reach, reach * radius, reach);
        /* Grains shrink with the core, which warms as it falls. */
        coreLook.size = f.dist * CORE_GRAIN * radius;
        coreLook.color.copy(COLD).lerp(EMBER, 1 - radius);
        coreLook.opacity = 0.075 * natal;
      }
    },
  };
}
