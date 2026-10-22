import {
  Sprite,
  type Matrix3,
  type Object3D,
  type PerspectiveCamera,
  type WebGLRenderer,
} from "three";

import { createBrush } from "@/space/brush";
/**
 * Parker Solar Probe in the Sun lab: on its record orbit at the model's moment
 * (`@/space/sun/model/parker`), plunging to 9.86 R☉ and swinging out past 150 R☉ every 88 days;
 * in the orbit view its ellipse and a marker riding it; and at its true size
 * (`@/space/spacecraft`) once the camera closes on it, its heat shield turned to the Sun.
 */
import { closeUpLimits } from "@/space/close-up-flight";
import { spacecraftFrame } from "@/space/spacecraft/models";
import { createSpacecraftPass, type Craft } from "@/space/spacecraft/scene/spacecraft-pass";
import { PARKER_ECCENTRICITY, RADIUS_M } from "@/space/sun/model/parameters";
import { PARKER_SEMI_MAJOR_R } from "@/space/sun/model/parker";
import type { Vec3 } from "@horizon/toolkit/math";
import { SOLAR_GOLD, ownedLine, worldPerPixel, type SceneHostBasics } from "@horizon/toolkit/scene";

import { parkerOf, type SunFrame } from "./frame";
import type { ViewAim } from "./views";

/** The ellipse: segments, even in eccentric anomaly so the plunge is as smooth as the rest. */
const ORBIT_SEGMENTS = 256;
const ORBIT_OPACITY = 0.5;
/** The marker riding it, CSS px across, and the smallest stage height it is sized for. */
const MARKER_PX = 12;
const MIN_STAGE_PX = 480;
const MARKER_COLOR = `#${SOLAR_GOLD.toString(16).padStart(6, "0")}`;

export function createParkerLayer(
  basics: SceneHostBasics,
  parent: Object3D,
  deps: { gamut: Matrix3; invalidate: () => void },
) {
  const { scope, viewport } = basics;
  const pass = createSpacecraftPass(basics, {
    unitM: RADIUS_M,
    gamut: deps.gamut,
    invalidate: deps.invalidate,
  });

  const orbit = ownedLine(scope, SOLAR_GOLD, ORBIT_OPACITY, ORBIT_SEGMENTS);
  const minor = PARKER_SEMI_MAJOR_R * Math.sqrt(1 - PARKER_ECCENTRICITY ** 2);
  for (let i = 0; i <= ORBIT_SEGMENTS; i++) {
    const E = (i / ORBIT_SEGMENTS) * Math.PI * 2;
    /* As `keplerPosition` places the probe: perihelion toward +x, prograde about the pole. */
    orbit.positions.set(
      [PARKER_SEMI_MAJOR_R * (Math.cos(E) - PARKER_ECCENTRICITY), 0, -minor * Math.sin(E)],
      i * 3,
    );
  }
  const brush = createBrush();
  const markerMaterial = brush.sprite(MARKER_COLOR, 1, true);
  scope.defer(() => {
    markerMaterial.dispose();
    brush.dispose();
  });
  const marker = new Sprite(markerMaterial);
  orbit.line.visible = marker.visible = false;
  parent.add(orbit.line, marker);

  /** The radius the close-up frames, solar radii, and its zoom bounds. */
  const frame = spacecraftFrame("parker") / RADIUS_M;
  const point: Vec3 = [0, 0, 0];
  const sunward: Vec3 = [0, 0, 0];
  const craft: Craft = { key: "parker", model: "parker", at: [0, 0, 0], facing: [0, 0, 0] };
  const crafts = [craft];
  const sun: Vec3 = [0, 0, 0];

  return {
    frame,
    limits: closeUpLimits(frame, frame),
    /**
     * What the close-up orbits: the probe at the frame's moment, its up toward the Sun, so the
     * camera keeps its place in the light as the probe swings round.
     */
    aim(f: SunFrame): ViewAim {
      parkerOf(f, point);
      const r = Math.hypot(...point);
      sunward[0] = -point[0] / r;
      sunward[1] = -point[1] / r;
      sunward[2] = -point[2] / r;
      return { point, normal: sunward };
    },
    /**
     * Places the probe from the camera (a few solar radii out, exact well under a millimetre),
     * and in the orbit view its ellipse and marker.
     */
    update(
      dt: number,
      f: SunFrame,
      camera: PerspectiveCamera,
      show: { orbit: boolean; closeUp: boolean },
    ) {
      parkerOf(f, point);
      orbit.line.visible = marker.visible = show.orbit;
      if (show.orbit) {
        marker.position.set(point[0], point[1], point[2]);
        const away = camera.position.distanceTo(marker.position);
        const stage = Math.max(MIN_STAGE_PX, viewport.height);
        marker.scale.setScalar(worldPerPixel(camera.fov, away, stage) * MARKER_PX);
      }
      for (let k = 0; k < 3; k++) {
        const eye = camera.position.getComponent(k);
        craft.at[k] = point[k]! - eye;
        craft.facing[k] = sun[k] = -eye;
      }
      pass.update({ dt, sun, crafts, approach: show.closeUp ? "parker" : null });
    },
    render: (renderer: WebGLRenderer) => pass.render(renderer),
    /** The probe is big enough on screen to show, and its model is still on its way. */
    get waiting() {
      return pass.waiting;
    },
  };
}
