import assert from "node:assert/strict";
import test from "node:test";

import { PerspectiveCamera, Vector3 } from "three";

import { DisposalScope } from "@horizon/toolkit/rendering";

import { VIEW_IDS } from "../src/features/sun/lib/model/views.ts";
import { createSunCamera } from "../src/features/sun/lib/scene/camera-rig.ts";
import { viewAim, viewPose } from "../src/features/sun/lib/scene/views.ts";
import { createSunModel, SEEDED_GROUPS } from "../src/space/sun/frame.ts";

/* The rig's controls listen on the canvas and the window; nothing here sends them input. */
const quiet = () => ({ addEventListener() {}, removeEventListener() {} });
globalThis.window ??= { ...quiet(), matchMedia: () => ({ matches: false, ...quiet() }) };
globalThis.document ??= quiet();

const WIDTH = 1280;
const HEIGHT = 720;
const canvas = {
  ...quiet(),
  style: {},
  clientWidth: WIDTH,
  clientHeight: HEIGHT,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: WIDTH, height: HEIGHT }),
  setPointerCapture() {},
  releasePointerCapture() {},
};

test("from any view the camera flies to the next one's own framing, whatever it stood at", () => {
  const frame = createSunModel(7, { seeded: SEEDED_GROUPS }).frameAt({
    time: 3600,
    cyclePhase: 25.4,
    light: "white",
    eruptionScrub: 0.5,
    fieldLineCount: 8,
  });
  for (const from of VIEW_IDS)
    for (const to of VIEW_IDS) {
      if (from === to) continue;
      const camera = new PerspectiveCamera(48, WIDTH / HEIGHT, 0.001, 1e4);
      const settings = { view: from, selection: null, closeUp: false };
      const rig = createSunCamera(new DisposalScope(), {
        camera,
        canvas,
        host: { closest: () => null },
        viewport: { width: WIDTH, height: HEIGHT },
        reduceMotion: { matches: false, ...quiet() },
        invalidate() {},
        parker: { aim: () => null },
        settings: () => settings,
        drawn: () => frame,
      });
      const fly = (view) => {
        settings.view = view;
        rig.viewChanged(view);
        for (let i = 0; i < 240; i++) rig.step(frame, 1 / 30);
      };
      fly(from);
      fly(to);
      /* It stands its view's distance from what the view orbits, looking at it. */
      const fitted = { width: WIDTH, height: HEIGHT, fov: camera.fov, bottomInset: 0 };
      const { distance } = viewPose(to, frame, { azimuth: 0, inclination: 0 }, fitted);
      const aim = new Vector3(...(viewAim(to, frame)?.point ?? [0, 0, 0]));
      const offset = camera.position.clone().sub(aim);
      assert.ok(
        Math.abs(offset.length() / distance - 1) < 0.02,
        `${from} → ${to}: ${offset.length().toFixed(3)} from its aim, framed at ${distance.toFixed(3)}`,
      );
      const look = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      assert.ok(look.dot(offset.normalize().negate()) > 0.99, `${from} → ${to}: looks at its aim`);
    }
});
