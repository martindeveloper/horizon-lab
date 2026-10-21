/**
 * The ship's camera. The ship sits at the scene's origin; its heliocentric position (km,
 * doubles) is what everything is placed against.
 *
 * - In orbit it holds station about a body on an orbit pose that drag, wheel, pinch and the
 *   camera pad move.
 * - By hand it has an attitude of its own: a drag looks, the keys, a gamepad and the throttle
 *   lever thrust with one-g thrusters, the clocks run at the flight assist's warp
 *   (model/assist.ts), and the ship falls in the Sun's, its body's and that body's partner's
 *   gravity. Striking a surface faster than a hard landing wrecks it.
 * - The autopilot turns onto its route, then flies the drive's real trip (model/autopilot.ts)
 *   and settles into orbit; disengaged, the ship flies on by hand at the speed it had.
 */
import { Matrix4, Quaternion, Vector3, type PerspectiveCamera } from "three";

import { FRAME_RADII } from "@/space/solar-system/model/framing";
import {
  ORBIT_STEP,
  createFlightAxes,
  createFlightInput,
  createOrbitInput,
  stepOrbit,
  turnFree,
  type FlightAxes,
  type OrbitPose,
  type OrbitTurn,
  type Quat,
} from "@horizon/toolkit/camera";
import { clamp, smootherstep, wrapSigned } from "@horizon/toolkit/math";
import type { DisposalScope } from "@horizon/toolkit/rendering";
import {
  ORBIT_INCLINATION,
  createLogZoom,
  distanceVec3d,
  vec3d,
  type Vec3d,
} from "@horizon/toolkit/scene";
import { properVelocity } from "@horizon/toolkit/science";

import { GALACTIC_NORTH, anchorRadius, isBodyAnchor, type AnchorId } from "../model/anchors";
import { MANOEUVRE_ACCEL, assistWarp } from "../model/assist";
import {
  ALIGN_S,
  progressOf,
  transit,
  transitPhase,
  transitSeconds,
  type FlightPhase,
} from "../model/autopilot";
import { worldBody } from "../model/bodies";
import {
  PIECES_PER_DYNAMICAL_TIME,
  createWell,
  dynamicalTime,
  gmOf,
  gravityAt,
} from "../model/gravity";
import {
  ALTITUDE_FLOOR,
  COSMIC_FAR_KM,
  CRASH_KM_S,
  C_KM_S,
  DRIVES,
  NEAR_PLANE_KM,
  SUN_ALTITUDE_FLOOR,
  type Drive,
} from "../model/parameters";
import { tripProgress, tripTimes, type TripTimes } from "../model/relativity";
import {
  createShip,
  haltShip,
  shipSpeed,
  stepShip,
  type ShipGravity,
  type ShipMode,
  type ShipState,
} from "../model/ship";

/** Arrival: this far round from the Sun (three-quarter light), this far above the ecliptic. */
const ARRIVE_SWING = 0.9;
const ARRIVE_INCLINATION = 0.3;
/** The framed body's apparent radius, as a fraction of half the view's shorter side. */
const ARRIVE_FILL = 0.55;
/** The farthest a parked ship may back off, in the body's radii. */
const FARTHEST_RADII = 20_000;
/** How far an arrival may swing from its line of approach towards the lit side, radians. */
const APPROACH_SWING = 1.1;
/** Pieces a frame of manual flight is cut into at most; past it the warp holds back near a body. */
const MAX_PIECES = 400;
/** A button step eases out over about a third of a second: the time constant, seconds. */
const STEP_EASE = 0.08;
/** How long after the last input the scene still counts as handled, ms. */
const RELEASE_MS = 700;
/** Radians of look per CSS pixel of drag in free flight. */
const LOOK_RAD_PER_PX = 0.0035;
/** Radians of roll per second at full deflection. */
const ROLL_RAD_PER_S = 1.2;
/** Boost multiplies the drive's thrust or speed. */
const BOOST = 10;
/** Seconds the velocity of the body the ship rides is measured over. */
const VELOCITY_S = 60;
/** Seconds entering orbit takes to turn the nose from where it pointed onto the body. */
const SETTLE_S = 1.4;
/**
 * With the ship's feel on, coming into orbit the ship sinks this share of its distance inside
 * the orbit and rises back, deepest this many seconds in: weight, without a second bounce.
 */
const SINK = 0.015;
const SINK_TAU_S = 0.18;

type Leg = { aim: AnchorId; pose: OrbitPose };

type Flight = {
  /** The body the route leaves from, and where from it the route starts, km. */
  from: AnchorId;
  start: Vec3d;
  to: Leg;
  /** Real seconds since the flight began (the transit starts after the align), and the transit's. */
  t: number;
  seconds: number;
  /** The attitude the flight left from. */
  q0: Quaternion;
  /** The drive's trip, and the clocks as it began. */
  trip: TripTimes;
  drive: Drive;
  km: number;
  tau0: number;
  t0: number;
  /** The scales the route leaves and arrives at, km: the orbits' distances. */
  x0: number;
  x1: number;
  /** The share of the trip's proper time reached, and the flight second it passed halfway. */
  s: number;
  flipAt: number;
};

export type ShipCamera = ReturnType<typeof createShipCamera>;

export function createShipCamera(
  scope: DisposalScope,
  camera: PerspectiveCamera,
  canvas: HTMLCanvasElement,
  options: {
    reduceMotion: { matches: boolean };
    /** Where a body is at a date, km, heliocentric. */
    bodyAt: (id: AnchorId, date: Date, out: Vec3d) => Vec3d;
    /** The date the scene is drawn at. */
    now: () => Date;
    /** Sets that date to Earth's clock `t` (seconds since the epoch) and returns it. */
    clock: (t: number) => Date;
    /** The body nearest a point, by its surface. */
    nearest: (at: Vec3d) => AnchorId;
    /** Ship seconds per real second flown by hand at a height above the nearest surface, km. */
    warp?: (heightKm: number) => number;
    /** The tangent of half the view's shorter angle. */
    halfTan: () => number;
    /** Whether a key event is the scene's to take. */
    isShortcut: (event: KeyboardEvent) => boolean;
    /** Asks the frame loop for a frame. */
    invalidate: () => void;
    /** After the pose follows an input. */
    onInput?: () => void;
    /** The ship left its parking place for free flight, or parked. */
    onMode?: (mode: ShipMode) => void;
    /** The ship struck a body's surface at `speed` km/s relative to it. */
    onCrash?: (id: AnchorId, speed: number) => void;
  },
) {
  const { reduceMotion, bodyAt, halfTan, warp: warpAt = assistWarp } = options;
  const ship: ShipState = createShip();
  let mode: ShipMode = "orbit";
  let aim: AnchorId = "earth";
  const pose: OrbitPose = { azimuth: 0.6, inclination: ARRIVE_INCLINATION, distance: 1 };
  /** The attitude in free flight, camera to world (three's convention). */
  let attitude: Quat = [0, 0, 0, 1];
  const floorOf = (id: AnchorId) =>
    anchorRadius(id) * (id === "sun" ? SUN_ALTITUDE_FLOOR : ALTITUDE_FLOOR);
  /** An orbit entered farther out than the usual reach keeps its distance: no jump inwards. */
  let farthest = 0;
  const limits = () => ({
    min: floorOf(aim),
    max: Math.max(anchorRadius(aim) * FARTHEST_RADII, farthest),
  });
  const zoom = createLogZoom(pose.distance, { limits });
  let flight: Flight | null = null;
  /** The throttle lever, 0…1: thrust ahead wherever the keys give none. */
  let cruise = 0;
  /** Entering orbit: the attitude it left from and the seconds since. */
  let settle: { q0: Quaternion; t: number } | null = null;
  /** A camera-pad step still to ease in, radians. */
  const stepping = { azimuth: 0, inclination: 0, on: false };
  /** Wrecked on a surface: nothing moves until the pilot takes the ship back to orbit. */
  let crashed = false;
  /** The ship's feel is on; seconds since it came into orbit with weight, while it sinks (else −1). */
  let feel = false;
  let sink = -1;
  const weighty = () => (feel && !reduceMotion.matches ? 0 : -1);
  let interacting = false;
  let releaseTimer = 0;
  let drive: Drive = DRIVES.torch;

  const aimPos = vec3d();
  const fromPos = vec3d();
  const toPos = vec3d();
  const route = vec3d();
  const later = vec3d();
  const velocity = vec3d();
  const relative = vec3d();
  const thrustDir = vec3d();
  const offset = new Vector3();
  const look = new Matrix4();
  const eye = new Vector3();
  const target = new Vector3();
  const up = new Vector3(0, 1, 0);
  const lookQuat = new Quaternion();
  const toward = new Quaternion();
  const facing = new Quaternion();
  const fwd = new Vector3();
  const right = new Vector3();
  const top = new Vector3();
  const dateLater = new Date();
  const hands = createFlightAxes();
  const earlier = vec3d();
  const pull = vec3d();
  /** Ship seconds per real second over the last frame: the rate asked for, or what held it back. */
  let warpNow = 0;
  /** The pull on the ship, km/s², and the body pulling hardest, as last read. */
  const pulled: { gravity: number; from: AnchorId } = { gravity: 0, from: "sun" };

  /** A body's heliocentric velocity, km/s, from its motion over a minute. */
  const bodyVelocity = (id: AnchorId, out: Vec3d) => {
    const now = options.now();
    bodyAt(id, now, earlier);
    dateLater.setTime(now.getTime() + VELOCITY_S * 1000);
    bodyAt(id, dateLater, later);
    out[0] = (later[0] - earlier[0]) / VELOCITY_S;
    out[1] = (later[1] - earlier[1]) / VELOCITY_S;
    out[2] = (later[2] - earlier[2]) / VELOCITY_S;
    return out;
  };

  /** The wells a ship near a body falls in: the Sun, the body, and its planet or its big moon. */
  const wells = [createWell(), createWell(), createWell()];
  const wellIds: (AnchorId | null)[] = [null, null, null];
  const partnerOf = (id: AnchorId): AnchorId | null => {
    if (id === "earth") return "moon";
    if (!isBodyAnchor(id)) return null;
    const world = worldBody(id);
    return world.kind === "moon" ? world.host : null;
  };
  /** Loads the wells about `near` as they are now, with their velocities when the ship will fall. */
  const loadWells = (near: AnchorId, moving: boolean) => {
    const now = options.now();
    const partner = partnerOf(near);
    wellIds[0] = "sun";
    wellIds[1] = near === "sun" ? null : near;
    wellIds[2] = partner;
    for (let i = 0; i < wells.length; i += 1) {
      const id = wellIds[i];
      const well = wells[i]!;
      well.gm = id ? gmOf(id) : 0;
      if (!id || well.gm <= 0) continue;
      bodyAt(id, now, well.pos);
      if (moving) bodyVelocity(id, well.vel);
      else well.vel[0] = well.vel[1] = well.vel[2] = 0;
    }
  };
  const gravity: ShipGravity = { at: (x, dt, out) => gravityAt(x, wells, dt, out), pieces: 1 };
  const thrust = { accel: 0, dir: thrustDir };

  /** Reads the pull where the ship is now, and the body pulling hardest. */
  const readGravity = () => {
    loadWells(options.nearest(ship.x), false);
    gravityAt(ship.x, wells, 0, pull);
    pulled.gravity = Math.hypot(pull[0], pull[1], pull[2]);
    let hardest = 0;
    for (let i = 0; i < wells.length; i += 1) {
      const well = wells[i]!;
      if (well.gm <= 0) continue;
      const g = well.gm / Math.max(1e-9, distanceVec3d(ship.x, well.pos) ** 2);
      if (g > hardest) {
        hardest = g;
        pulled.from = wellIds[i]!;
      }
    }
    return pulled;
  };

  /**
   * The pose that frames a body on arrival, lit three-quarters from the Sun; the Galaxy is
   * framed from its north, so the disk lies below. Coming in along `from` (unit, from the
   * body towards the ship), it keeps near that line, swinging towards the framing by at most
   * a little over a radian, so the body stays ahead to the end.
   */
  const arrival = (id: AnchorId, from?: Readonly<Vec3d>): OrbitPose => {
    const framed = framing(id);
    if (!from) return framed;
    const azimuth = Math.atan2(from[0], from[2]);
    const inclination = clamp(
      Math.asin(clamp(from[1], -1, 1)),
      ORBIT_INCLINATION.min,
      ORBIT_INCLINATION.max,
    );
    return {
      azimuth:
        azimuth +
        clamp(wrapSigned(framed.azimuth - azimuth, Math.PI * 2), -APPROACH_SWING, APPROACH_SWING),
      inclination:
        inclination + clamp(framed.inclination - inclination, -APPROACH_SWING, APPROACH_SWING),
      distance: framed.distance,
    };
  };

  const framing = (id: AnchorId): OrbitPose => {
    bodyAt(id, options.now(), toPos);
    const sunward =
      Math.hypot(toPos[0], toPos[2]) > 0 ? Math.atan2(-toPos[0], -toPos[2]) : pose.azimuth;
    const frameRadius = anchorRadius(id) * ((isBodyAnchor(id) && FRAME_RADII[id]) || 1);
    const distance = Math.max(floorOf(id), frameRadius / (halfTan() * ARRIVE_FILL));
    if (id === "galacticCentre")
      return {
        azimuth: Math.atan2(GALACTIC_NORTH.x, GALACTIC_NORTH.z),
        inclination: clamp(
          Math.asin(GALACTIC_NORTH.y),
          ORBIT_INCLINATION.min,
          ORBIT_INCLINATION.max,
        ),
        distance,
      };
    return {
      azimuth: id === "sun" ? pose.azimuth : sunward + ARRIVE_SWING,
      inclination: ARRIVE_INCLINATION,
      distance,
    };
  };

  const offsetOf = ({ azimuth, inclination, distance }: OrbitPose, out: Vector3) =>
    out.set(
      distance * Math.cos(inclination) * Math.sin(azimuth),
      distance * Math.sin(inclination),
      distance * Math.cos(inclination) * Math.cos(azimuth),
    );

  /** The pose about `id` that puts the ship where it is now. */
  const poseAbout = (id: AnchorId): OrbitPose => {
    bodyAt(id, options.now(), aimPos);
    const dx = ship.x[0] - aimPos[0];
    const dy = ship.x[1] - aimPos[1];
    const dz = ship.x[2] - aimPos[2];
    const distance = Math.hypot(dx, dy, dz);
    return {
      azimuth: Math.atan2(dx, dz),
      inclination: clamp(
        Math.asin(dy / Math.max(distance, 1e-9)),
        ORBIT_INCLINATION.min,
        ORBIT_INCLINATION.max,
      ),
      distance,
    };
  };

  const touched = () => {
    options.onInput?.();
    interacting = true;
    window.clearTimeout(releaseTimer);
    releaseTimer = window.setTimeout(() => {
      interacting = false;
      options.invalidate();
    }, RELEASE_MS);
    options.invalidate();
  };

  const moving = (axes: FlightAxes) =>
    axes.thrust !== 0 || axes.strafe !== 0 || axes.lift !== 0 || axes.roll !== 0;

  /** The pilot's hands: the keys', the lever's thrust where they give none; the brake lets it go. */
  const handsNow = (): FlightAxes => {
    const axes = flightInput.axes;
    if (cruise === 0 || axes.thrust !== 0 || axes.brake > 0) return axes;
    Object.assign(hands, axes);
    hands.thrust = cruise;
    return hands;
  };

  const setMode = (next: ShipMode) => {
    if (mode === next) return;
    mode = next;
    options.onMode?.(next);
  };

  const orbitInput = scope.own(
    createOrbitInput(canvas, {
      getPose: () => ({ ...pose, distance: zoom.target }),
      enabled: () => mode === "orbit" && flight === null,
      onChange: (next) => {
        pose.azimuth = next.azimuth;
        pose.inclination = next.inclination;
        if (next.distance !== zoom.target) {
          const clamped = zoom.zoomTo(next.distance, orbitInput.active);
          if (reduceMotion.matches) {
            pose.distance = clamped;
            zoom.settle(clamped);
          }
        }
        touched();
      },
      /* The input keeps to the world's whole envelope; the zoom clamps to the aim's own. */
      distance: { min: NEAR_PLANE_KM, max: COSMIC_FAR_KM },
      inclination: ORBIT_INCLINATION,
      dragSensitivity: { azimuth: 0.0055, inclination: 0.0045 },
      wheelSensitivity: () => 0.0012,
    }),
  );
  const flightInput = scope.own(
    createFlightInput(canvas, {
      onLook: (dx, dy) => {
        if (mode !== "free" || flight) return;
        attitude = turnFree(attitude, -dx * LOOK_RAD_PER_PX, -dy * LOOK_RAD_PER_PX);
        touched();
      },
      onAxes: (axes) => {
        if (flight) return;
        if (mode === "orbit" && moving(axes)) enterFree();
        touched();
      },
      onWheel: () => undefined,
      isShortcut: options.isShortcut,
      /* The keys count while anything on the simulation's stage has focus: the dock included. */
      stage: canvas.closest("[data-simulation]") ?? canvas.parentElement,
    }),
  );
  scope.defer(() => window.clearTimeout(releaseTimer));
  /* The canvas takes focus when pressed, so the keys follow a click; nothing tabs to it. */
  const tabIndexWas = canvas.getAttribute("tabindex");
  canvas.tabIndex = -1;
  const focusCanvas = () => canvas.focus({ preventScroll: true });
  canvas.addEventListener("pointerdown", focusCanvas);
  scope.defer(() => {
    canvas.removeEventListener("pointerdown", focusCanvas);
    if (tabIndexWas === null) canvas.removeAttribute("tabindex");
    else canvas.setAttribute("tabindex", tabIndexWas);
  });

  /** Parks at a leg's pose; an arrival (`weighted`) settles into it. */
  const land = (to: Leg, weighted = false) => {
    aim = to.aim;
    farthest = 0;
    settle = null;
    sink = weighted ? weighty() : -1;
    pose.azimuth = to.pose.azimuth;
    pose.inclination = to.pose.inclination;
    pose.distance = to.pose.distance;
    zoom.settle(pose.distance);
    haltShip(ship);
    flight = null;
    setMode("orbit");
  };

  /** The ship's speed on a flight, km/s: none while it aligns, then the drive's at this point of its trip. */
  const flightSpeed = ({ t, s, drive: engine, trip }: Flight) => {
    if (t < ALIGN_S) return 0;
    if (engine.kind === "coast") return engine.speed;
    const tauLeg = Math.min(s, 1 - s) * trip.tau;
    return C_KM_S * Math.tanh((engine.accel * tauLeg) / C_KM_S);
  };

  /**
   * Leaves the orbit at rest beside the body, riding its motion, looking where the camera
   * looked: the keys then move the ship the way they say, and gravity pulls only gently. A
   * switch hands the keys the canvas's focus; the lever keeps its own, so its arrows keep working.
   */
  const enterFree = (focus = true) => {
    if (mode === "free") return;
    settle = null;
    attitude = camera.quaternion.toArray();
    bodyVelocity(aim, velocity);
    ship.u[0] = velocity[0];
    ship.u[1] = velocity[1];
    ship.u[2] = velocity[2];
    orbitInput.cancel();
    setMode("free");
    /* The keys fly from here: the canvas holds focus, wherever the switch was pressed. */
    if (focus) focusCanvas();
  };

  /** Enters orbit about the nearest body, where the ship is, riding with it; the nose turns onto it. */
  const park = () => {
    cruise = 0;
    if (mode === "orbit") return;
    aim = options.nearest(ship.x);
    const about = poseAbout(aim);
    farthest = about.distance;
    settle = reduceMotion.matches ? null : { q0: camera.quaternion.clone(), t: 0 };
    sink = weighty();
    const bounds = limits();
    pose.azimuth = about.azimuth;
    pose.inclination = about.inclination;
    pose.distance = clamp(about.distance, bounds.min, bounds.max);
    zoom.settle(pose.distance);
    haltShip(ship);
    flightInput.cancel();
    setMode("orbit");
  };

  /**
   * Keeps the ship above the nearest body's surface, taking the inward speed away; returns
   * that body. Striking it faster than a hard landing is a crash: the ship stops where it hit.
   */
  const keepAboveGround = () => {
    const id = options.nearest(ship.x);
    bodyAt(id, options.now(), aimPos);
    const floor = floorOf(id);
    const dx = ship.x[0] - aimPos[0];
    const dy = ship.x[1] - aimPos[1];
    const dz = ship.x[2] - aimPos[2];
    const d = Math.hypot(dx, dy, dz);
    if (d >= floor || d === 0) return id;
    const k = floor / d;
    ship.x[0] = aimPos[0] + dx * k;
    ship.x[1] = aimPos[1] + dy * k;
    ship.x[2] = aimPos[2] + dz * k;
    bodyVelocity(id, velocity);
    const inward =
      ((ship.u[0] - velocity[0]) * dx +
        (ship.u[1] - velocity[1]) * dy +
        (ship.u[2] - velocity[2]) * dz) /
      d;
    if (inward < 0) {
      ship.u[0] -= (inward * dx) / d;
      ship.u[1] -= (inward * dy) / d;
      ship.u[2] -= (inward * dz) / d;
    }
    if (-inward > CRASH_KM_S) {
      crashed = true;
      aim = id;
      ship.u[0] = velocity[0];
      ship.u[1] = velocity[1];
      ship.u[2] = velocity[2];
      cruise = 0;
      flightInput.cancel();
      options.onCrash?.(id, -inward);
    }
    return id;
  };

  /**
   * The ship's proper velocity less the aim body's motion, km/s: what the markers and the brake
   * work against. Bodies move at a ten-thousandth of c, so the plain difference serves.
   */
  const relativeVelocity = (out: Vec3d) => {
    bodyVelocity(aim, velocity);
    out[0] = ship.u[0] - velocity[0];
    out[1] = ship.u[1] - velocity[1];
    out[2] = ship.u[2] - velocity[2];
    return out;
  };

  /**
   * Free flight for one frame: roll in real time; thrust and gravity in ship time at the flight
   * assist's warp unless the clocks are held, cut down where gravity needs finer steps than a
   * frame allows. A coasting drive keeps the ship's speed through the body's frame to its
   * cruise. Returns the nearest body once moved.
   */
  const fly = (dt: number, compression: number): AnchorId | undefined => {
    warpNow = 0;
    if (crashed) {
      /* The wreck rides the body it lies on. */
      bodyVelocity(aim, velocity);
      ship.u[0] = velocity[0];
      ship.u[1] = velocity[1];
      ship.u[2] = velocity[2];
      stepShip(ship, dt, null);
      return;
    }
    const axes = handsNow();
    if (axes.park) {
      park();
      return;
    }
    if (axes.roll !== 0) attitude = turnFree(attitude, 0, 0, axes.roll * ROLL_RAD_PER_S * dt);
    if (compression <= 0 || dt <= 0) return;
    const near = options.nearest(ship.x);
    bodyAt(near, options.now(), aimPos);
    let dtau = warpAt(distanceVec3d(ship.x, aimPos) - anchorRadius(near)) * dt;
    loadWells(near, true);
    let shortest = Infinity;
    for (const well of wells)
      if (well.gm > 0)
        shortest = Math.min(shortest, dynamicalTime(distanceVec3d(ship.x, well.pos), well.gm));
    const piece = shortest / PIECES_PER_DYNAMICAL_TIME;
    if (dtau > MAX_PIECES * piece) dtau = MAX_PIECES * piece;
    gravity.pieces = Number.isFinite(piece) ? Math.ceil(dtau / piece) : 1;
    warpNow = dtau / dt;
    facing.fromArray(attitude);
    fwd.set(0, 0, -1).applyQuaternion(facing);
    right.set(1, 0, 0).applyQuaternion(facing);
    top.set(0, 1, 0).applyQuaternion(facing);
    thrustDir[0] = fwd.x * axes.thrust + right.x * axes.strafe + top.x * axes.lift;
    thrustDir[1] = fwd.y * axes.thrust + right.y * axes.strafe + top.y * axes.lift;
    thrustDir[2] = fwd.z * axes.thrust + right.z * axes.strafe + top.z * axes.lift;
    const push = Math.hypot(thrustDir[0], thrustDir[1], thrustDir[2]);
    const boost = 1 + (BOOST - 1) * axes.boost;
    /* A key is full thrust; the lever and a stick's travel are a share of it. */
    const level = Math.min(1, push);
    let thrusting = false;
    if (push > 0) {
      thrustDir[0] /= push;
      thrustDir[1] /= push;
      thrustDir[2] /= push;
      thrust.accel = MANOEUVRE_ACCEL * boost * level;
      thrusting = true;
    } else if (axes.brake > 0) {
      /* A brake burn against the motion relative to the body; it never overshoots. */
      relativeVelocity(relative);
      const w = Math.hypot(relative[0], relative[1], relative[2]);
      if (w > 0) {
        thrustDir[0] = -relative[0] / w;
        thrustDir[1] = -relative[1] / w;
        thrustDir[2] = -relative[2] / w;
        thrust.accel = Math.min(MANOEUVRE_ACCEL * boost * axes.brake, w / dtau);
        thrusting = true;
      }
    }
    stepShip(ship, dtau, thrusting ? thrust : null, gravity);
    /* A coasting drive goes no faster through the body's frame than its cruise. */
    if (drive.kind === "coast") {
      relativeVelocity(relative);
      const w = Math.hypot(relative[0], relative[1], relative[2]);
      const most = properVelocity(drive.speed / C_KM_S);
      if (w > most) {
        const k = most / w;
        ship.u[0] = velocity[0] + relative[0] * k;
        ship.u[1] = velocity[1] + relative[1] * k;
        ship.u[2] = velocity[2] + relative[2] * k;
      }
    }
    return keepAboveGround();
  };

  /** Looks from the origin back along `from` at the aim. */
  const lookAt = (from: Vector3) => {
    eye.set(0, 0, 0);
    target.set(-from.x, -from.y, -from.z);
    look.lookAt(eye, target, up);
    camera.quaternion.copy(lookQuat.setFromRotationMatrix(look));
  };

  const rig = {
    ship,
    pose,
    get mode() {
      return mode;
    },
    /** The body the ship is at, nearest, or heading for. */
    get aim() {
      return aim;
    },
    /** Where a flight is heading, or the aim. */
    get destination() {
      return flight?.to.aim ?? aim;
    },
    get flying() {
      return flight !== null;
    },
    /** Wrecked on a surface. */
    get crashed() {
      return crashed;
    },
    /** What the autopilot is doing, or null with none flying. */
    get phase(): FlightPhase | null {
      if (!flight) return null;
      if (flight.t < ALIGN_S) return "align";
      return transitPhase(
        flight.drive,
        flight.s,
        flight.flipAt < 0 ? -1 : flight.t - flight.flipAt,
      );
    },
    /** Real seconds since the flight began; 0 with none. */
    get flightSeconds() {
      return flight?.t ?? 0;
    },
    /** Ship seconds per real second over the last frame: the auto warp, or a warp held back. */
    get warp() {
      return warpNow;
    },
    /** Reads the pull on the ship, km/s², and the body pulling hardest (a reused object). */
    readGravity,
    /** A flight, a zoom still gliding, a button step, a gesture settling, or the keys held. */
    get moving() {
      return (
        flight !== null ||
        settle !== null ||
        (cruise > 0 && mode === "free") ||
        zoom.moving ||
        stepping.on ||
        sink >= 0 ||
        interacting ||
        flightInput.active ||
        orbitInput.active
      );
    },
    /** The ship's speed relative to the Sun, km/s: the drive's on a flight, the body's parked. */
    get speed() {
      if (flight) return flightSpeed(flight);
      if (mode === "free") return shipSpeed(ship);
      bodyVelocity(aim, velocity);
      return Math.hypot(velocity[0], velocity[1], velocity[2]);
    },
    /** The pilot's hands this frame: the keys', the gamepad's and the lever's. */
    get axes(): Readonly<FlightAxes> {
      return handsNow();
    },
    /** The ship's velocity relative to the body it is near, km/s, written into `out`. */
    relativeVelocity,
    /** The ship's feel: arrivals settle into orbit with weight. */
    setFeel(on: boolean) {
      feel = on;
      if (!on) sink = -1;
    },
    /** The drive the keys thrust with and flights fly with. */
    setDrive(next: Drive) {
      drive = next;
    },
    /** The throttle lever, 0…1; opening it in orbit takes the helm. */
    setThrottle(level: number) {
      const next = clamp(level, 0, 1);
      if (next === cruise || crashed) return;
      cruise = next;
      if (cruise > 0 && flight === null && mode === "orbit") enterFree(false);
      options.invalidate();
    },
    /** The helm button: manual flight, or orbit about the nearest body. */
    setMode(next: ShipMode) {
      if (flight || crashed) return;
      if (next === "free") enterFree();
      else park();
    },
    /** Puts the ship in orbit at a body at once, framed as an arrival. */
    snapTo(id: AnchorId) {
      land({ aim: id, pose: arrival(id) });
    },
    /**
     * Flies the ship to a body with the drive: it turns onto the route, then flies the drive's
     * real trip on the auto warp, the clocks keeping its time, and settles into orbit. With
     * reduced motion the ship arrives at once, the clocks jump.
     */
    flyTo(id: AnchorId) {
      if (flight?.to.aim === id || crashed) return;
      const now = options.now();
      /* From where the ship is: the body it orbits, or, flown by hand or under way, the nearest. */
      const from = mode === "orbit" && !flight ? aim : options.nearest(ship.x);
      bodyAt(from, now, fromPos);
      const start = vec3d(ship.x[0] - fromPos[0], ship.x[1] - fromPos[1], ship.x[2] - fromPos[2]);
      /* The arrival keeps near the line of approach, so the destination stays ahead. */
      bodyAt(id, now, toPos);
      route[0] = ship.x[0] - toPos[0];
      route[1] = ship.x[1] - toPos[1];
      route[2] = ship.x[2] - toPos[2];
      const back = Math.hypot(route[0], route[1], route[2]);
      if (back > 0) for (let i = 0; i < 3; i += 1) route[i]! /= back;
      const to: Leg = { aim: id, pose: arrival(id, back > 0 ? route : undefined) };
      /* The trip runs to the arrival point, not the body's centre: it matters at the Galaxy. */
      bodyAt(id, now, toPos);
      offsetOf(to.pose, offset);
      const km = Math.hypot(
        toPos[0] + offset.x - ship.x[0],
        toPos[1] + offset.y - ship.x[1],
        toPos[2] + offset.z - ship.x[2],
      );
      const trip = tripTimes(drive, km);
      if (reduceMotion.matches) {
        ship.tau += trip.tau;
        ship.t += trip.t;
        land(to);
        return;
      }
      const x0 = Math.max(floorOf(from), Math.hypot(start[0], start[1], start[2]));
      flight = {
        from,
        start,
        to,
        t: 0,
        seconds: transitSeconds(km, x0, to.pose.distance),
        q0: camera.quaternion.clone(),
        trip,
        drive,
        km,
        tau0: ship.tau,
        t0: ship.t,
        x0,
        x1: to.pose.distance,
        s: 0,
        flipAt: -1,
      };
      haltShip(ship);
      orbitInput.cancel();
      flightInput.cancel();
      cruise = 0;
      settle = null;
      stepping.on = false;
    },
    /** After a crash: the ship back in orbit about the body it struck, framed as an arrival. */
    recover() {
      if (!crashed) return;
      crashed = false;
      land({ aim, pose: arrival(aim) });
      options.invalidate();
    },
    /** Hands a flight to the pilot where it is: the ship flies on by hand at the speed it had. */
    disengage() {
      if (!flight) return;
      attitude = camera.quaternion.toArray();
      aim = options.nearest(ship.x);
      flight = null;
      farthest = 0;
      setMode("free");
      options.invalidate();
    },
    /** A camera-pad step: eases in; steps pressed in a row add up; reduced motion snaps. */
    turnBy(step: OrbitTurn) {
      if (flight) return;
      if (mode === "free") {
        attitude = turnFree(attitude, -step.azimuth * ORBIT_STEP, step.inclination * ORBIT_STEP);
        return;
      }
      const { azimuth, inclination } = pose;
      if (reduceMotion.matches) {
        Object.assign(pose, stepOrbit(pose, step, { inclination: ORBIT_INCLINATION }));
        return;
      }
      const ahead = stepping.on;
      const from = {
        azimuth: azimuth + (ahead ? stepping.azimuth : 0),
        inclination: inclination + (ahead ? stepping.inclination : 0),
      };
      const to = stepOrbit({ ...pose, ...from }, step, { inclination: ORBIT_INCLINATION });
      stepping.azimuth = to.azimuth - azimuth;
      stepping.inclination = to.inclination - inclination;
      stepping.on = true;
    },
    /**
     * Advances the flight, the free flight, or the parked ship's zoom and steps, runs the
     * clocks at `compression` ship seconds per real second (a parked ship rides with its body,
     * so Earth's clock keeps pace), then places the ship and the camera.
     */
    step(dt: number, compression: number) {
      if (flight) {
        const f = flight;
        f.t += dt;
        /* The transit's playback share, where along the route that puts the ship, and so where on its trip. */
        const w = clamp((f.t - ALIGN_S) / f.seconds, 0, 1);
        const covered = f.km > 0 ? transit(w, f.km, f.x0, f.x1) / f.km : 1;
        const s = progressOf(f.drive, f.km, covered, f.trip);
        const tauBefore = ship.tau;
        const { elapsed } = tripProgress(f.drive, f.km, s, f.trip);
        ship.tau = f.tau0 + s * f.trip.tau;
        ship.t = f.t0 + elapsed * f.trip.t;
        warpNow = dt > 0 ? (ship.tau - tauBefore) / dt : 0;
        if (s >= 0.5 && f.flipAt < 0) f.flipAt = f.t;
        f.s = s;
        const now = options.clock(ship.t);
        /* The route runs between its ends as their bodies move on. */
        bodyAt(f.from, now, fromPos);
        bodyAt(f.to.aim, now, toPos);
        offsetOf(f.to.pose, offset);
        const ax = fromPos[0] + f.start[0];
        const ay = fromPos[1] + f.start[1];
        const az = fromPos[2] + f.start[2];
        route[0] = toPos[0] + offset.x - ax;
        route[1] = toPos[1] + offset.y - ay;
        route[2] = toPos[2] + offset.z - az;
        ship.x[0] = ax + route[0] * covered;
        ship.x[1] = ay + route[1] * covered;
        ship.x[2] = az + route[2] * covered;
        /* The sky sees the drive's speed along the route, as the dock reports it. */
        const way = Math.hypot(route[0], route[1], route[2]);
        const v = way > 0 ? flightSpeed(f) : 0;
        const u = v > 0 ? properVelocity(v / C_KM_S) / way : 0;
        ship.u[0] = route[0] * u;
        ship.u[1] = route[1] * u;
        ship.u[2] = route[2] * u;
        /* The view keeps the destination ahead, flip and braking included. */
        offset.set(ship.x[0] - toPos[0], ship.x[1] - toPos[1], ship.x[2] - toPos[2]);
        lookAt(offset);
        /* The nose turns from where it was onto the destination while the ship aligns. */
        const turned = smootherstep(clamp(f.t / ALIGN_S, 0, 1));
        if (turned < 1)
          camera.quaternion.slerpQuaternions(f.q0, toward.copy(camera.quaternion), turned);
        if (w >= 1) land(f.to, true);
      } else if (mode === "free") {
        const near = fly(dt, compression);
        options.clock(ship.t);
        if (near) aim = near;
        camera.quaternion.fromArray(attitude);
      } else {
        warpNow = compression;
        if (compression > 0) {
          ship.tau += compression * dt;
          ship.t += compression * dt;
        }
        const now = options.clock(ship.t);
        if (stepping.on) {
          const k = 1 - Math.exp(-dt / STEP_EASE);
          const done = Math.abs(stepping.azimuth) < 1e-4 && Math.abs(stepping.inclination) < 1e-4;
          const da = done ? stepping.azimuth : stepping.azimuth * k;
          const di = done ? stepping.inclination : stepping.inclination * k;
          pose.azimuth += da;
          pose.inclination += di;
          stepping.azimuth -= da;
          stepping.inclination -= di;
          stepping.on = !done;
        }
        pose.distance = zoom.step(dt, pose.distance).distance;
        bodyAt(aim, now, aimPos);
        offsetOf(pose, offset);
        if (sink >= 0) {
          sink += dt;
          const u = sink / SINK_TAU_S;
          offset.multiplyScalar(1 - SINK * u * Math.exp(1 - u));
          if (u > 6) sink = -1;
        }
        ship.x[0] = aimPos[0] + offset.x;
        ship.x[1] = aimPos[1] + offset.y;
        ship.x[2] = aimPos[2] + offset.z;
        lookAt(offset);
        /* Entering orbit: the nose turns from where it pointed onto the body. */
        if (settle) {
          settle.t += dt;
          const k = smootherstep(clamp(settle.t / SETTLE_S, 0, 1));
          if (k < 1)
            camera.quaternion.slerpQuaternions(settle.q0, toward.copy(camera.quaternion), k);
          else settle = null;
        }
      }
      camera.position.set(0, 0, 0);
      camera.updateMatrixWorld();
    },
  };
  return rig;
}
