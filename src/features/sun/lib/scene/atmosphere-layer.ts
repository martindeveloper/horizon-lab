/**
 * The light beyond the limb and over the disc: a larger proxy sphere drawn from inside or out
 * (its back faces), added to the frame; the disc occludes analytically in the shader
 * (`atmosphere.frag.glsl`).
 */
import {
  AdditiveBlending,
  BackSide,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  Vector4,
  type Scene,
} from "three";

import type { DisposalScope } from "@horizon/toolkit/rendering";

import ATMOSPHERE_FRAG from "../graphics/atmosphere.frag.glsl";
import type { createLightTables } from "../graphics/light-tables";
import PROXY_VERT from "../graphics/proxy.vert.glsl";
import {
  ATMOSPHERE_RADIUS,
  HOLE_MAX,
  HOLE_WIDTH,
  STREAMER_MAX,
  STREAMER_MIN_APEX,
  STREAMER_WIDTH,
} from "../parameters";
import type { SunQuality } from "../quality";
import { directionOf, type Polyline, type SunFrame } from "./frame";
import type { SunLooks } from "./looks";
import type { SunSceneSettings } from "./settings";

export function createAtmosphereLayer(
  scope: DisposalScope,
  scene: Scene,
  looks: SunLooks,
  tables: ReturnType<typeof createLightTables>,
) {
  const streamers = looks.uniforms.uStreamer.value;
  const holes = looks.uniforms.uHole.value;
  const uniforms = {
    ...looks.uniforms,
    uRamp: { value: tables.ramp },
    uResponse: { value: tables.response },
    uCorona: { value: new Vector3() },
    uCoronaFE: { value: new Vector2() },
    uEruption: { value: new Vector4(0, 1, 0, 0) },
    uEruptionShape: { value: new Vector4() },
    uCmePresence: { value: 0 },
    uCurrentSheet: { value: new Vector3() },
    uSamples: { value: 20 },
    uSpicules: { value: 1 },
    uSunlight: { value: new Vector3(...tables.sunlight) },
  };
  const material = scope.own(
    new ShaderMaterial({
      vertexShader: PROXY_VERT,
      fragmentShader: ATMOSPHERE_FRAG,
      uniforms,
      side: BackSide,
      blending: AdditiveBlending,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  const mesh = new Mesh(scope.own(new SphereGeometry(ATMOSPHERE_RADIUS, 48, 32)), material);
  mesh.name = "The Sun's atmosphere";
  mesh.renderOrder = 3;
  scene.add(mesh);
  scope.defer(() => mesh.removeFromParent());
  const axis: [number, number, number] = [0, 1, 0];
  let shapedBy = -1;
  /** The field's shape over the limb: a streamer per high closed apex, a hole per open foot. */
  const shape = (lines: Polyline[]) => {
    type Apex = { x: number; y: number; z: number; r: number };
    const apexes: Apex[] = [];
    const feet: Apex[] = [];
    for (const line of lines) {
      if (line.count < 2) continue;
      if (line.open) {
        const r = Math.hypot(line.points[0]!, line.points[1]!, line.points[2]!) || 1;
        feet.push({ x: line.points[0]! / r, y: line.points[1]! / r, z: line.points[2]! / r, r: 1 });
        continue;
      }
      let best: Apex | null = null;
      for (let i = 0; i < line.count; i++) {
        const x = line.points[i * 3]!;
        const y = line.points[i * 3 + 1]!;
        const z = line.points[i * 3 + 2]!;
        const r = Math.hypot(x, y, z);
        if (!best || r > best.r) best = { x: x / r, y: y / r, z: z / r, r };
      }
      if (best && best.r > STREAMER_MIN_APEX) apexes.push(best);
    }
    apexes.sort((a, b) => b.r - a.r);
    /* Apexes within a streamer's base width of a higher one join it. */
    const kept: Apex[] = [];
    for (const apex of apexes) {
      if (kept.length >= STREAMER_MAX) break;
      if (kept.some((k) => 1 - (k.x * apex.x + k.y * apex.y + k.z * apex.z) < STREAMER_WIDTH))
        continue;
      kept.push(apex);
    }
    kept.forEach((a, k) => streamers[k]!.set(a.x, a.y, a.z, a.r));
    uniforms.uStreamerCount.value = kept.length;
    const keptFeet: Apex[] = [];
    for (const foot of feet) {
      if (keptFeet.length >= HOLE_MAX) break;
      if (keptFeet.some((k) => 1 - (k.x * foot.x + k.y * foot.y + k.z * foot.z) < HOLE_WIDTH))
        continue;
      keptFeet.push(foot);
    }
    keptFeet.forEach((f, k) => holes[k]!.set(f.x, f.y, f.z, 1));
    uniforms.uHoleCount.value = keptFeet.length;
  };
  return {
    mesh,
    setQuality(quality: SunQuality) {
      uniforms.uSamples.value = quality.coronaSamples;
      uniforms.uSpicules.value = quality.spicules ? 1 : 0;
    },
    update(frame: SunFrame, settings: SunSceneSettings) {
      /* Nothing of the atmosphere shows in a light that weighs none of its layers (white light, the magnetogram). */
      const w = uniforms.uWeights.value;
      mesh.visible = w.y > 0 || w.z > 0 || w.w > 0 || uniforms.uFlareWeight.value > 0;
      if (!mesh.visible) return;
      if (frame.fieldRevision !== shapedBy) {
        shapedBy = frame.fieldRevision;
        shape(frame.fieldLines);
      }
      const { k, f, e } = settings.corona;
      uniforms.uCorona.value.set(k[0], k[1], k[2]);
      uniforms.uCoronaFE.value.set(f, e);
      const eruption = frame.eruption;
      const region = eruption ? frame.regions.find((r) => r.id === eruption.regionId) : undefined;
      if (eruption && region) {
        directionOf(region.lat, region.lon, axis);
        uniforms.uEruption.value.set(axis[0], axis[1], axis[2], eruption.cmeFront);
        uniforms.uCmePresence.value = eruption.cmePresence;
        uniforms.uEruptionShape.value.set(
          eruption.cmeSpread,
          eruption.flareLight,
          eruption.ropeHeight,
          region.strength,
        );
        uniforms.uCurrentSheet.value.set(
          eruption.sheetBottom,
          eruption.sheetTop,
          eruption.reconnection,
        );
      } else {
        uniforms.uEruption.value.w = 0;
        uniforms.uCmePresence.value = 0;
        uniforms.uCurrentSheet.value.set(0, 0, 0);
      }
    },
  };
}
