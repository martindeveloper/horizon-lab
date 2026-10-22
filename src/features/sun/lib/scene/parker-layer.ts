import {
  BackSide,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Sprite,
  Vector3,
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
import { CLOSE_UP_FILL, closeUpLimits } from "@/space/close-up-flight";
import { spacecraftFrame } from "@/space/spacecraft/models";
import { createSpacecraftPass, type Craft } from "@/space/spacecraft/scene/spacecraft-pass";
import { PARKER_CORONA_EDGE_R, PARKER_ECCENTRICITY, RADIUS_M } from "@/space/sun/model/parameters";
import { PARKER_SEMI_MAJOR_R } from "@/space/sun/model/parker";
import type { Vec3 } from "@horizon/toolkit/math";
import {
  BELOW,
  SOLAR_GOLD,
  ownedLine,
  worldPerPixel,
  type PlaceLabel,
  type SceneHostBasics,
} from "@horizon/toolkit/scene";

import { parkerOf, type SunFrame } from "./frame";
import type { ViewAim } from "./views";

/** The ellipse: segments, even in eccentric anomaly so the plunge is as smooth as the rest. */
const ORBIT_SEGMENTS = 256;
const ORBIT_OPACITY = 0.5;
/** The marker riding it, CSS px across, and the smallest stage height it is sized for. */
const MARKER_PX = 12;
const MIN_STAGE_PX = 480;
const MARKER_COLOR = `#${SOLAR_GOLD.toString(16).padStart(6, "0")}`;
/**
 * The corona's edge, a shell round the Sun, drawn as its outline from the camera: a fainter,
 * cooler line than the orbit.
 */
const EDGE_COLOR = 0xcfd8e6;
const EDGE_OPACITY = 0.35;
/**
 * The shell's faint fill, its far side only: a soft disc round the Sun from outside, deepening
 * over the whole sky the moment the camera is inside, so the crossing shows wherever it looks.
 */
const SHELL_OPACITY = { outside: 0.04, inside: 0.1 };
const SHELL_SEGMENTS: readonly [number, number] = [64, 32];
/**
 * The ride: behind the heat shield, this far off the line from the Sun through the probe
 * (radians), so the Sun stands beyond it in view, and the probe at this share of the close-up's
 * fill, so the Sun has room.
 */
const Z_AXIS = new Vector3(0, 0, 1);
const RIDE_OFF_AXIS = 0.2;
/**
 * The bearing of that offset round the Sun–probe line: toward the north pole (in the close-up's
 * frame, a quarter turn from east), as the orbit view looks down from the north.
 */
const RIDE_BEARING = -Math.PI / 2;
const RIDE_FILL_SHARE = 0.3;

export function createParkerLayer(
  basics: SceneHostBasics,
  parent: Object3D,
  deps: { gamut: Matrix3; invalidate: () => void; place: PlaceLabel },
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
  /* A unit circle, turned to face the camera and sized to the shell's outline each frame. */
  const edge = ownedLine(scope, EDGE_COLOR, EDGE_OPACITY, ORBIT_SEGMENTS);
  for (let i = 0; i <= ORBIT_SEGMENTS; i++) {
    const a = (i / ORBIT_SEGMENTS) * Math.PI * 2;
    edge.positions.set([Math.cos(a), Math.sin(a), 0], i * 3);
  }
  const shellMaterial = scope.own(
    new MeshBasicMaterial({
      color: EDGE_COLOR,
      transparent: true,
      opacity: SHELL_OPACITY.outside,
      side: BackSide,
      depthWrite: false,
    }),
  );
  const shell = new Mesh(
    scope.own(new SphereGeometry(PARKER_CORONA_EDGE_R, ...SHELL_SEGMENTS)),
    shellMaterial,
  );
  const brush = createBrush();
  const markerMaterial = brush.sprite(MARKER_COLOR, 1, true);
  scope.defer(() => {
    markerMaterial.dispose();
    brush.dispose();
  });
  const marker = new Sprite(markerMaterial);
  orbit.line.visible = edge.line.visible = shell.visible = marker.visible = false;
  parent.add(shell, orbit.line, edge.line, marker);

  /** The radius the close-up frames, solar radii, and its zoom bounds. */
  const frame = spacecraftFrame("parker") / RADIUS_M;
  const point: Vec3 = [0, 0, 0];
  const sunward: Vec3 = [0, 0, 0];
  const craft: Craft = { key: "parker", model: "parker", at: [0, 0, 0], facing: [0, 0, 0] };
  const crafts = [craft];
  const sun: Vec3 = [0, 0, 0];
  const toCamera = new Vector3();
  const up = new Vector3();

  return {
    frame,
    limits: closeUpLimits(frame, frame),
    /**
     * The ride's pose in the close-up's frame (up toward the Sun): behind the probe, looking
     * past its shield at the Sun.
     */
    ridePose: (halfTan: number) => ({
      azimuth: RIDE_BEARING,
      inclination: RIDE_OFF_AXIS - Math.PI / 2,
      distance: frame / (halfTan * CLOSE_UP_FILL * RIDE_FILL_SHARE),
    }),
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
      /* The corona's edge stays with the close-up too: riding in, its outline round the Sun
         grows and sweeps past as the probe crosses it. Seen from D away, a sphere's outline is
         the circle r²/D toward the camera, of radius r·√(1 − r²/D²); inside, there is none. */
      const away = camera.position.length();
      shell.visible = show.orbit || show.closeUp;
      const inside = away < PARKER_CORONA_EDGE_R;
      shellMaterial.opacity = inside ? SHELL_OPACITY.inside : SHELL_OPACITY.outside;
      const edgeShown = shell.visible && !inside;
      edge.line.visible = edgeShown;
      if (edgeShown) {
        const k = PARKER_CORONA_EDGE_R / away;
        toCamera.copy(camera.position).divideScalar(away);
        edge.line.quaternion.setFromUnitVectors(Z_AXIS, toCamera);
        edge.line.position.copy(toCamera).multiplyScalar(PARKER_CORONA_EDGE_R * k);
        edge.line.scale.setScalar(PARKER_CORONA_EDGE_R * Math.sqrt(1 - k * k));
        /* Its name on the outline's top, as the screen has it. */
        up.set(0, 1, 0).applyQuaternion(camera.quaternion).multiplyScalar(edge.line.scale.x);
        up.add(edge.line.position);
      }
      deps.place("coronaEdge", up.x, up.y, up.z, edgeShown, BELOW);
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
