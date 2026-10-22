import assert from "node:assert/strict";
import test from "node:test";

import { PerspectiveCamera, Vector3 } from "three";

import { freeFromOrbit } from "@horizon/toolkit/camera";

import { eruptionEnvelope, frameInsets } from "../src/features/sun/lib/scene/framing.ts";
import {
  featureOrbitFrame,
  freeInWorld,
  viewAim,
  viewPose,
  viewSubjectRadius,
} from "../src/features/sun/lib/scene/views.ts";
import {
  bipoleAxis,
  createSunModel,
  OBSERVED_REGIONS,
  surfacePoint,
} from "../src/space/sun/frame.ts";

const viewports = [
  { width: 390, height: 844, fov: 48 },
  { width: 390, height: 844, fov: 48, bottomInset: 296 },
  { width: 1440, height: 900, fov: 48 },
  { width: 844, height: 390, fov: 48 },
];

function cameraFor(id, frame, viewport) {
  const pose = viewPose(id, frame, { azimuth: 0.4, inclination: 0.1 }, viewport);
  const aim = viewAim(id, frame);
  const local = freeFromOrbit(pose);
  const free = aim ? freeInWorld(local, aim.point, featureOrbitFrame(aim.normal)) : local;
  /* The far plane reaches past the subject, as the engine's does (Parker's orbit is far out). */
  const far = Math.max(100, 2 * pose.distance);
  const camera = new PerspectiveCamera(viewport.fov, viewport.width / viewport.height, 0.001, far);
  camera.setViewOffset(
    viewport.width,
    viewport.height,
    0,
    frameInsets(viewport).offsetY,
    viewport.width,
    viewport.height,
  );
  camera.position.fromArray(free.position);
  camera.quaternion.fromArray(free.orientation);
  camera.updateMatrixWorld();
  return { camera, aim, pose };
}

test("presets keep their subjects inside portrait, desktop and landscape-phone frames", () => {
  const model = createSunModel(7, { observed: OBSERVED_REGIONS });
  const frame = model.frameAt({
    time: 0,
    cyclePhase: 25.4,
    light: "white",
    eruptionScrub: 0.5,
    fieldLineCount: 8,
  });
  for (const viewport of viewports) {
    for (const id of [
      "surface",
      "inside",
      "cycle",
      "corona",
      "sunspot",
      "chromosphere",
      "eruption",
      "orbit",
    ]) {
      const { camera, aim } = cameraFor(id, frame, viewport);
      const centre = new Vector3(...(aim?.point ?? [0, 0, 0]));
      const radius = viewSubjectRadius(id, frame);
      for (let i = 0; i < 256; i++) {
        const y = 1 - (2 * (i + 0.5)) / 256;
        const azimuth = i * Math.PI * (3 - Math.sqrt(5));
        const p = new Vector3(
          Math.sqrt(1 - y * y) * Math.cos(azimuth),
          y,
          Math.sqrt(1 - y * y) * Math.sin(azimuth),
        );
        p.multiplyScalar(radius).add(centre).project(camera);
        assert.ok(
          Math.abs(p.x) < 0.96 && Math.abs(p.y) < 0.8,
          `${id} clips at ${viewport.width}×${viewport.height}: ${p.toArray()}`,
        );
        assert.ok(p.z < 1, `${id} is before the far plane`);
        if (viewport.bottomInset)
          assert.ok(
            ((1 - p.y) * viewport.height) / 2 < viewport.height - viewport.bottomInset,
            `${id} overlaps the expanded mobile dock`,
          );
      }
    }
  }
});

test("eruption framing follows every stage, including reused geometry and the escaping CME", () => {
  const model = createSunModel(7, { observed: OBSERVED_REGIONS });
  let initialRadius = 0;
  for (const s of [0, 0.25, 0.5, 0.75, 1]) {
    const frame = model.frameAt({
      time: 0,
      cyclePhase: 25.4,
      light: "fe171",
      eruptionScrub: s,
      fieldLineCount: 8,
    });
    const bounds = eruptionEnvelope(frame);
    if (s === 0) initialRadius = bounds.radius;
    if (s === 1)
      assert.ok(bounds.radius > initialRadius * 3, "the framing expands with the ejection");
    const region = frame.regions.find((r) => r.id === frame.eruption.regionId);
    const axis = new Vector3(...surfacePoint(region.lat, region.lon));
    const centre = axis.clone().multiplyScalar(bounds.centre);
    for (const line of frame.eruption.lines) {
      if (line.kind !== "rope" && line.kind !== "postflare") continue;
      for (let i = 0; i < line.count; i++) {
        const p = new Vector3().fromArray(line.points, i * 3);
        assert.ok(
          p.distanceTo(centre) <= bounds.radius + 1e-5,
          `arcade leaves its framing at ${s}`,
        );
      }
    }
    for (const viewport of viewports) {
      const { camera, pose } = cameraFor("eruption", frame, viewport);
      assert.ok(pose.distance < 36, "the camera can reach the fitted distance");
      const front = axis.clone().multiplyScalar(frame.eruption.cmeFront).project(camera);
      assert.ok(Math.abs(front.x) < 0.96 && Math.abs(front.y) < 0.8, `CME is clipped at ${s}`);
    }
  }
});

test("the eruption camera presents the reconnection plane across region tilts and hemispheres", () => {
  const model = createSunModel(7, { observed: OBSERVED_REGIONS });
  const frame = model.frameAt({
    time: 0,
    cyclePhase: 25.4,
    light: "fe171",
    eruptionScrub: 0.6,
    fieldLineCount: 8,
  });
  const region = frame.regions.find((r) => r.id === frame.eruption.regionId);
  for (const lat of [-0.6, 0, 0.6]) {
    for (const tilt of [-0.4, 0, 0.4]) {
      region.lat = lat;
      region.tilt = tilt;
      const { camera, aim } = cameraFor("eruption", frame, viewports[2]);
      const worldRegion = { ...region, lon: region.lon + frame.surfaceTurn };
      const normal = new Vector3(...surfacePoint(worldRegion.lat, worldRegion.lon));
      const across = new Vector3(...bipoleAxis(worldRegion));
      const planeNormal = normal.cross(across).normalize();
      const sightline = camera.position
        .clone()
        .sub(new Vector3(...aim.point))
        .normalize();
      assert.ok(Math.abs(sightline.dot(planeNormal)) > 0.9, "the loops are not viewed edge-on");
    }
  }
});
