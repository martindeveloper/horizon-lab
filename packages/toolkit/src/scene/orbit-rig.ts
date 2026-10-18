/**
 * An orbit camera on the log zoom: a pose (azimuth, inclination, distance) about an aim point.
 * Wheel and pinch glide on a spring, flights carry the zoom's speed out and land at rest, and
 * a flight may turn the angles along the way. A simulation adds where the aim sits (`home`),
 * how the orbit's frame is oriented (`orient`), its limits and its own views on top.
 */
import { Quaternion, Vector3, type PerspectiveCamera } from "three";

import { stepOrbit, type OrbitPose, type OrbitTurn } from "../camera";
import { smootherstep, wrapSigned } from "../math";
import { createLogZoom, type ZoomLimits } from "./log-zoom";

/** How far the orbit tilts above and below its plane, radians. */
export const ORBIT_INCLINATION = { min: -1.45, max: 1.45 };

export type OrbitAngles = { azimuth: number; inclination: number };

export type OrbitRigOptions = {
  /** The pose to start from. */
  pose: OrbitPose;
  /** Zoom bounds, world units; read whenever the zoom clamps. */
  limits: () => ZoomLimits;
  /** While it matches, zooms and flights land at once. */
  reduceMotion: { matches: boolean };
  /** Smallest near plane, world units (the default near plane is 1/5000 of the distance). */
  nearFloor?: number;
  /** Far plane for a distance and aim; 40 × the distance by default. */
  far?: (distance: number, aim: Vector3) => number;
  /**
   * Someone else owns the distance for now (`held`: only follow it), or limits that moved
   * should not pull it back (`clamp: false`). Read each step.
   */
  follow?: () => { held: boolean; clamp: boolean };
  /** Each step, before the zoom moves. */
  onStep?: (dt: number) => void;
  /** Something besides the zoom is still moving the camera. */
  busy?: () => boolean;
  /** Places the aim for the pose; the origin by default. */
  home?: (aim: Vector3, pose: OrbitPose) => void;
  /** Orients the orbit's frame for a distance; identity (orbits about +y) by default. */
  orient?: (distance: number, frame: Quaternion) => void;
};

export type OrbitRig = ReturnType<typeof createOrbitRig>;

export function createOrbitRig(camera: PerspectiveCamera, options: OrbitRigOptions) {
  const { limits, reduceMotion, nearFloor = 0, far = (d: number) => d * 40 } = options;
  const zoom = createLogZoom(options.pose.distance, { limits });
  const offset = new Vector3();
  /** A flight's turn: where the angles started and how far they go. */
  let turn: { from: OrbitAngles; by: OrbitAngles } | null = null;

  const rig = {
    pose: { ...options.pose },
    aim: new Vector3(),
    /** The orbit's frame this frame (see `orient`). */
    frame: new Quaternion(),
    /** A flight is under way. */
    get flying() {
      return zoom.flying;
    },
    /** A flight, a zoom still gliding, or something else moving the camera. */
    get moving() {
      return zoom.moving || (options.busy?.() ?? false);
    },
    /** Where the zoom is heading, world units. */
    get target() {
      return zoom.target;
    },
    limits,
    reduceMotion,

    /** The pose input steps from: the zoom's destination, so wheel notches add up. */
    inputPose(): OrbitPose {
      return { ...rig.pose, distance: rig.target };
    },
    /** Input asks for a distance; `direct` (a pinch) follows closely. Keeps the zoom's speed. */
    zoomTo(distance: number, direct: boolean) {
      const next = zoom.zoomTo(distance, direct);
      if (reduceMotion.matches) {
        rig.pose.distance = next;
        rig.settle();
      }
    },
    /** The pose was set outright (a snap, a landing): nothing left to glide. */
    settle() {
      turn = null;
      zoom.settle(rig.pose.distance);
    },
    /** Ends a flight; the zoom glides to rest from its current speed, without turning back. */
    cancel() {
      turn = null;
      zoom.cancel(rig.pose.distance);
    },
    /** Sets the pose outright. */
    snap(pose: Partial<OrbitPose>) {
      Object.assign(rig.pose, pose);
      rig.settle();
    },
    /** Flies to a distance; with `angles`, turns to them along the way. */
    flyTo(distance: number, angles?: OrbitAngles) {
      if (reduceMotion.matches) {
        rig.snap({ distance, ...angles });
        return;
      }
      if (!angles && Math.abs(Math.log(distance / rig.pose.distance)) < 0.012) return;
      zoom.fly(rig.pose.distance, distance);
      const { azimuth, inclination } = rig.pose;
      turn = angles
        ? {
            from: { azimuth, inclination },
            by: {
              azimuth: wrapSigned(angles.azimuth - azimuth, Math.PI * 2),
              inclination: angles.inclination - inclination,
            },
          }
        : null;
    },
    /**
     * A button step; it snaps, so it reads the same with reduced motion. During a turning
     * flight the step carries on to where the flight lands.
     */
    turnBy(step: OrbitTurn) {
      const { azimuth, inclination } = rig.pose;
      Object.assign(rig.pose, stepOrbit(rig.pose, step, { inclination: ORBIT_INCLINATION }));
      if (turn) {
        turn.from.azimuth += rig.pose.azimuth - azimuth;
        turn.from.inclination += rig.pose.inclination - inclination;
      }
    },

    /** Advances the flight or the zoom spring. */
    step(dt: number) {
      options.onStep?.(dt);
      const { held, clamp } = options.follow?.() ?? { held: false, clamp: true };
      const { distance, progress } = zoom.step(dt, rig.pose.distance, held, clamp);
      if (progress !== null && turn) {
        const k = smootherstep(progress);
        rig.pose.azimuth = turn.from.azimuth + turn.by.azimuth * k;
        rig.pose.inclination = turn.from.inclination + turn.by.inclination * k;
      }
      if (progress === null || progress >= 1) turn = null;
      rig.pose.distance = distance;
    },
    /** Places the aim for this frame's pose. */
    home() {
      if (options.home) options.home(rig.aim, rig.pose);
      else rig.aim.set(0, 0, 0);
    },
    /** Puts the camera on the pose, and its frustum around the distance. */
    applyPose() {
      const { pose, aim, frame } = rig;
      const { azimuth, inclination, distance } = pose;
      if (options.orient) options.orient(distance, frame);
      offset
        .set(
          distance * Math.cos(inclination) * Math.sin(azimuth),
          distance * Math.sin(inclination),
          distance * Math.cos(inclination) * Math.cos(azimuth),
        )
        .applyQuaternion(frame);
      camera.position.copy(aim).add(offset);
      camera.up.set(0, 1, 0).applyQuaternion(frame);
      camera.lookAt(aim);
      camera.near = Math.max(nearFloor, distance / 5000);
      camera.far = far(distance, aim);
      camera.updateProjectionMatrix();
      /* Labels are projected before the renderer refreshes these; keep them on this frame's pose. */
      camera.updateMatrixWorld();
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    },
  };
  return rig;
}

/**
 * Moves a rig to framed views, each given as the pose that frames it. A flight keeps the
 * angles unless `turns` says the view wants its own; reduced motion arrives at once, framed
 * as the view is.
 */
export function createViewMoves<Id>(
  rig: OrbitRig,
  framing: (id: Id) => OrbitPose,
  turns: (id: Id) => boolean = () => false,
) {
  const snapToView = (id: Id) => rig.snap(framing(id));
  return {
    /** The pose that frames a view. */
    framing,
    snapToView,
    flyToView(id: Id) {
      if (rig.reduceMotion.matches) return snapToView(id);
      const pose = framing(id);
      rig.flyTo(pose.distance, turns(id) ? pose : undefined);
    },
  };
}
