/**
 * The ship's camera: the ship sits at the scene's origin and only its attitude is applied;
 * its heliocentric position (km, doubles) is what everything is placed against. Parked, the
 * ship holds station about a body on an orbit pose (azimuth, inclination, distance) that drag,
 * wheel, pinch and the camera pad move, as the Orrery's close-up does. In free flight the
 * ship has an attitude of its own: a drag looks around, the keys and a gamepad thrust along it
 * with the chosen drive, and the ship's state integrates in proper time; a scripted pilot (a
 * scene's flight) may hold the axes instead of the keys. A flight to another body pans the
 * view onto it, then dives, the distance moving in log space, while the drive's real trip
 * time passes on the two clocks and the planets move on underneath.
 */
import { Matrix4, Quaternion, Vector3, type PerspectiveCamera } from "three";

import { FRAME_RADII } from "@/space/solar-system/model/framing";
import {
  ORBIT_STEP,
  createFlightAxes,
  createFlightInput,
  createOrbitInput,
  freeBasis,
  slerpQuat,
  stepOrbit,
  turnFree,
  type FlightAxes,
  type OrbitPose,
  type OrbitTurn,
  type Quat,
} from "@horizon/toolkit/camera";
import { clamp, lerp, smootherstep, wrapSigned } from "@horizon/toolkit/math";
import type { DisposalScope } from "@horizon/toolkit/rendering";
import {
  ORBIT_INCLINATION,
  createLogZoom,
  distanceVec3d,
  vec3d,
  type Vec3d,
} from "@horizon/toolkit/scene";

import { GALACTIC_NORTH, anchorRadius, isBodyAnchor, type AnchorId } from "../model/anchors";
import {
  ALTITUDE_FLOOR,
  COSMIC_FAR_KM,
  C_KM_S,
  DRIVES,
  NEAR_PLANE_KM,
  SUN_ALTITUDE_FLOOR,
  type Drive,
} from "../model/parameters";
import { gammaOfSpeed, tripProgress, tripTimes, type TripTimes } from "../model/relativity";
import {
  createShip,
  haltShip,
  shipSpeed,
  stepShip,
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
/** Seconds a flight takes at least and at most; it grows with the scales it crosses. */
const FLIGHT_S = [5, 12] as const;
/** The share of a flight over which the attitude turns from where it was onto the aim. */
const FLIGHT_TURN = 0.3;
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
/** The sideways and vertical share of a coasting drive's speed. */
const SIDE_SHARE = 0.25;
/** Seconds the velocity of the body the ship rides is measured over. */
const VELOCITY_S = 60;

type Leg = { aim: AnchorId; pose: OrbitPose };

type Flight = {
  from: Leg;
  to: Leg;
  t: number;
  seconds: number;
  /** The attitude the flight left from. */
  q0: Quat;
  /** The drive's trip, and the clocks as it began. */
  trip: TripTimes;
  drive: Drive;
  km: number;
  tau0: number;
  t0: number;
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
    /** Half the tangent of the view's shorter free extent. */
    halfTan: () => number;
    /** Whether a key event is the scene's to take. */
    isShortcut: (event: KeyboardEvent) => boolean;
    /** Asks the frame loop for a frame. */
    invalidate: () => void;
    /** After the pose follows an input. */
    onInput?: () => void;
    /** The ship left its parking place for free flight, or parked. */
    onMode?: (mode: ShipMode) => void;
  },
) {
  const { reduceMotion, bodyAt, halfTan } = options;
  const ship: ShipState = createShip();
  let mode: ShipMode = "orbit";
  let aim: AnchorId = "earth";
  const pose: OrbitPose = { azimuth: 0.6, inclination: ARRIVE_INCLINATION, distance: 1 };
  /** The attitude in free flight, camera to world (three's convention). */
  let attitude: Quat = [0, 0, 0, 1];
  const floorOf = (id: AnchorId) =>
    anchorRadius(id) * (id === "sun" ? SUN_ALTITUDE_FLOOR : ALTITUDE_FLOOR);
  const limits = () => ({ min: floorOf(aim), max: anchorRadius(aim) * FARTHEST_RADII });
  const zoom = createLogZoom(pose.distance, { limits });
  let flight: Flight | null = null;
  /** Axes a script holds; while set, the keys and the gamepad are not read. */
  let scripted: FlightAxes | null = null;
  let stepping: { azimuth: number; inclination: number } | null = null;
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
  const dateLater = new Date();

  /** A body's heliocentric velocity, km/s, from its motion over a minute. */
  const bodyVelocity = (id: AnchorId, out: Vec3d) => {
    const now = options.now();
    bodyAt(id, now, fromPos);
    dateLater.setTime(now.getTime() + VELOCITY_S * 1000);
    bodyAt(id, dateLater, later);
    out[0] = (later[0] - fromPos[0]) / VELOCITY_S;
    out[1] = (later[1] - fromPos[1]) / VELOCITY_S;
    out[2] = (later[2] - fromPos[2]) / VELOCITY_S;
    return out;
  };

  /**
   * The pose that frames a body on arrival, lit three-quarters from the Sun; the Galaxy is
   * framed from its north, so the disk lies below.
   */
  const arrival = (id: AnchorId): OrbitPose => {
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

  const land = (to: Leg) => {
    aim = to.aim;
    pose.azimuth = to.pose.azimuth;
    pose.inclination = to.pose.inclination;
    pose.distance = to.pose.distance;
    zoom.settle(pose.distance);
    haltShip(ship);
    flight = null;
    setMode("orbit");
  };

  /** The ship's speed on a flight, km/s: the drive's cruise, or the torch's at this point of its burn. */
  const flightSpeed = ({ t, seconds, drive: engine, trip }: Flight) => {
    if (engine.kind === "coast") return engine.speed;
    const s = t / seconds;
    const tauLeg = Math.min(s, 1 - s) * trip.tau;
    return C_KM_S * Math.tanh((engine.accel * tauLeg) / C_KM_S);
  };

  /** Leaves the parking place with the body's own motion, looking where the camera looked. */
  const enterFree = () => {
    if (mode === "free") return;
    attitude = camera.quaternion.toArray();
    bodyVelocity(aim, velocity);
    ship.u[0] = velocity[0];
    ship.u[1] = velocity[1];
    ship.u[2] = velocity[2];
    orbitInput.cancel();
    setMode("free");
    /* The keys fly from here: the canvas holds focus, wherever the switch was pressed. */
    focusCanvas();
  };

  /** Parks the ship about the nearest body, where it is, riding with it. */
  const park = () => {
    scripted = null;
    if (mode === "orbit") return;
    aim = options.nearest(ship.x);
    const about = poseAbout(aim);
    const bounds = limits();
    pose.azimuth = about.azimuth;
    pose.inclination = about.inclination;
    pose.distance = clamp(about.distance, bounds.min, bounds.max);
    zoom.settle(pose.distance);
    haltShip(ship);
    flightInput.cancel();
    setMode("orbit");
  };

  /** Keeps the ship above the nearest body's surface, taking the inward speed away; returns that body. */
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

  /** Free flight for one frame: roll in real time, thrust in ship time. Returns the nearest body once moved. */
  const fly = (dt: number, compression: number): AnchorId | undefined => {
    const axes = scripted ?? flightInput.axes;
    if (axes.park) {
      park();
      return;
    }
    if (axes.roll !== 0) attitude = turnFree(attitude, 0, 0, axes.roll * ROLL_RAD_PER_S * dt);
    const dtau = compression * dt;
    if (dtau <= 0) return;
    const { fwd, right, up: top } = freeBasis(attitude);
    thrustDir[0] = fwd[0] * axes.thrust + right[0] * axes.strafe + top[0] * axes.lift;
    thrustDir[1] = fwd[1] * axes.thrust + right[1] * axes.strafe + top[1] * axes.lift;
    thrustDir[2] = fwd[2] * axes.thrust + right[2] * axes.strafe + top[2] * axes.lift;
    const push = Math.hypot(thrustDir[0], thrustDir[1], thrustDir[2]);
    const boost = 1 + (BOOST - 1) * axes.boost;
    if (drive.kind === "coast") {
      /* A coasting drive sets its speed outright; its sideways thrusters a share of it. */
      if (push > 0) {
        const along = axes.thrust !== 0 ? 1 : SIDE_SHARE;
        const v = Math.min(drive.speed * boost * along, 0.999 * C_KM_S);
        const gamma = gammaOfSpeed(v);
        ship.u[0] = (gamma * v * thrustDir[0]) / push;
        ship.u[1] = (gamma * v * thrustDir[1]) / push;
        ship.u[2] = (gamma * v * thrustDir[2]) / push;
      } else if (axes.brake > 0) {
        /* The brake matches the body's motion: the ship rides with it, as parked. */
        bodyVelocity(aim, velocity);
        ship.u[0] = velocity[0];
        ship.u[1] = velocity[1];
        ship.u[2] = velocity[2];
      }
      stepShip(ship, dtau, null);
    } else {
      let thrust: { accel: number; dir: Vec3d } | null = null;
      if (push > 0) {
        thrustDir[0] /= push;
        thrustDir[1] /= push;
        thrustDir[2] /= push;
        thrust = { accel: drive.accel * boost, dir: thrustDir };
      } else if (axes.brake > 0) {
        /* A brake burn against the motion relative to the body; it never overshoots. */
        relativeVelocity(relative);
        const w = Math.hypot(relative[0], relative[1], relative[2]);
        if (w > 0) {
          thrustDir[0] = -relative[0] / w;
          thrustDir[1] = -relative[1] / w;
          thrustDir[2] = -relative[2] / w;
          const accel = Math.min(drive.accel * boost * axes.brake, w / dtau);
          thrust = { accel, dir: thrustDir };
        }
      }
      stepShip(ship, dtau, thrust);
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
    /** A flight, a zoom still gliding, a button step, a gesture settling, or the keys held. */
    get moving() {
      return (
        flight !== null ||
        zoom.moving ||
        stepping !== null ||
        interacting ||
        scripted !== null ||
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
    /** The pilot's hands this frame: the script's, or the keys' and the gamepad's. */
    get axes(): Readonly<FlightAxes> {
      return scripted ?? flightInput.axes;
    },
    /** The ship's velocity relative to the body it is near, km/s, written into `out`. */
    relativeVelocity,
    /** The ship's distance from its aim's centre, km (the nearest body's in free flight). */
    get aimDistance() {
      if (mode !== "free" || flight) return pose.distance;
      bodyAt(aim, options.now(), aimPos);
      return distanceVec3d(ship.x, aimPos);
    },
    /** The drive the keys thrust with and flights fly with. */
    setDrive(next: Drive) {
      drive = next;
    },
    /**
     * A scripted pilot takes the axes (leaving the parking place if it asks to move), or
     * gives them back to the keys.
     */
    pilot(axes: Partial<FlightAxes> | null) {
      scripted = axes ? { ...createFlightAxes(), ...axes } : null;
      if (scripted && flight === null && mode === "orbit" && moving(scripted)) enterFree();
      options.invalidate();
    },
    /** The dock's mode switch. */
    setMode(next: ShipMode) {
      if (flight) return;
      if (next === "free") enterFree();
      else park();
    },
    /** Parks the ship at a body at once, framed as an arrival. */
    snapTo(id: AnchorId) {
      land({ aim: id, pose: arrival(id) });
    },
    /**
     * Flies the ship to a body with the drive: the view pans onto it, then dives; the drive's
     * trip passes on the clocks on the way. With reduced motion the ship arrives at once, the
     * clocks jump.
     */
    flyTo(id: AnchorId) {
      if (flight?.to.aim === id) return;
      /* From where the ship is: its parking pose, or, free or already under way, the nearest body's. */
      const from: Leg =
        mode === "orbit" && !flight
          ? { aim, pose: { ...pose, distance: zoom.target } }
          : { aim: options.nearest(ship.x), pose: poseAbout(options.nearest(ship.x)) };
      const to: Leg = { aim: id, pose: arrival(id) };
      /* The trip runs to the parking point, not the body's centre: it matters at the Galaxy. */
      bodyAt(id, options.now(), toPos);
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
      const efolds = Math.abs(Math.log(to.pose.distance / Math.max(1e-9, from.pose.distance)));
      const seconds = clamp(
        FLIGHT_S[0] + 0.35 * efolds + (id === from.aim ? 0 : 2),
        FLIGHT_S[0],
        FLIGHT_S[1],
      );
      flight = {
        from,
        to,
        t: 0,
        seconds,
        q0: camera.quaternion.toArray(),
        trip,
        drive,
        km,
        tau0: ship.tau,
        t0: ship.t,
      };
      haltShip(ship);
      orbitInput.cancel();
      flightInput.cancel();
      scripted = null;
      stepping = null;
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
      const from = {
        azimuth: azimuth + (stepping?.azimuth ?? 0),
        inclination: inclination + (stepping?.inclination ?? 0),
      };
      const to = stepOrbit({ ...pose, ...from }, step, { inclination: ORBIT_INCLINATION });
      stepping = { azimuth: to.azimuth - azimuth, inclination: to.inclination - inclination };
    },
    /**
     * Advances the flight, the free flight, or the parked ship's zoom and steps, runs the
     * clocks at `compression` ship seconds per real second (a parked ship rides with its body,
     * so Earth's clock keeps pace), then places the ship and the camera.
     */
    step(dt: number, compression: number) {
      if (flight) {
        flight.t = Math.min(flight.seconds, flight.t + dt);
        const s = flight.t / flight.seconds;
        /* The clocks run the drive's trip: proper time evenly, Earth's as the drive spends it. */
        const { elapsed } = tripProgress(flight.drive, flight.km, s);
        ship.tau = flight.tau0 + s * flight.trip.tau;
        ship.t = flight.t0 + elapsed * flight.trip.t;
        const now = options.clock(ship.t);
        const pan = smootherstep(clamp(s / 0.55, 0, 1));
        const dive = smootherstep(clamp((s - 0.12) / 0.88, 0, 1));
        const turn = smootherstep(s);
        const { from, to } = flight;
        pose.azimuth =
          from.pose.azimuth + wrapSigned(to.pose.azimuth - from.pose.azimuth, Math.PI * 2) * turn;
        pose.inclination = lerp(from.pose.inclination, to.pose.inclination, turn);
        pose.distance = Math.exp(
          lerp(Math.log(from.pose.distance), Math.log(to.pose.distance), dive),
        );
        bodyAt(from.aim, now, fromPos);
        bodyAt(to.aim, now, toPos);
        aimPos[0] = lerp(fromPos[0], toPos[0], pan);
        aimPos[1] = lerp(fromPos[1], toPos[1], pan);
        aimPos[2] = lerp(fromPos[2], toPos[2], pan);
        offsetOf(pose, offset);
        ship.x[0] = aimPos[0] + offset.x;
        ship.x[1] = aimPos[1] + offset.y;
        ship.x[2] = aimPos[2] + offset.z;
        /* The sky sees the drive's speed along the route, as the dock reports it. */
        route[0] = toPos[0] - fromPos[0];
        route[1] = toPos[1] - fromPos[1];
        route[2] = toPos[2] - fromPos[2];
        const way = Math.hypot(route[0], route[1], route[2]);
        const v = way > 0 ? flightSpeed(flight) : 0;
        const u = v > 0 ? (gammaOfSpeed(v) * v) / way : 0;
        ship.u[0] = route[0] * u;
        ship.u[1] = route[1] * u;
        ship.u[2] = route[2] * u;
        lookAt(offset);
        /* The attitude turns from where it was onto the aim over the flight's first part. */
        const turned = smootherstep(clamp(s / FLIGHT_TURN, 0, 1));
        if (turned < 1)
          camera.quaternion.fromArray(slerpQuat(flight.q0, camera.quaternion.toArray(), turned));
        if (s >= 1) land(to);
      } else if (mode === "free") {
        const near = fly(dt, compression);
        options.clock(ship.t);
        if (near) aim = near;
        camera.quaternion.fromArray(attitude);
      } else {
        if (compression > 0) {
          ship.tau += compression * dt;
          ship.t += compression * dt;
        }
        const now = options.clock(ship.t);
        if (stepping) {
          const k = 1 - Math.exp(-dt / STEP_EASE);
          const done = Math.abs(stepping.azimuth) < 1e-4 && Math.abs(stepping.inclination) < 1e-4;
          const da = done ? stepping.azimuth : stepping.azimuth * k;
          const di = done ? stepping.inclination : stepping.inclination * k;
          pose.azimuth += da;
          pose.inclination += di;
          stepping = done
            ? null
            : { azimuth: stepping.azimuth - da, inclination: stepping.inclination - di };
        }
        pose.distance = zoom.step(dt, pose.distance).distance;
        bodyAt(aim, now, aimPos);
        offsetOf(pose, offset);
        ship.x[0] = aimPos[0] + offset.x;
        ship.x[1] = aimPos[1] + offset.y;
        ship.x[2] = aimPos[2] + offset.z;
        lookAt(offset);
      }
      camera.position.set(0, 0, 0);
      camera.updateMatrixWorld();
    },
  };
  return rig;
}
