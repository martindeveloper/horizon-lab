/**
 * The orbit camera: its pose about an aim point, zoom limits, and one zoom across every
 * scale, from a close-up to the whole Galaxy. Distance moves in log space: a critically
 * damped spring follows wheel and pinch, and view flights run a quintic path that leaves at
 * the zoom's current speed and lands at rest. As the camera pulls out past the nearest
 * stars, the orbit frame turns from the ecliptic to the galactic plane and the aim slides
 * from the Sun to the galactic centre, so the solar map hands over to the Galaxy unbroken.
 */
import { Quaternion, Vector3, type PerspectiveCamera } from "three";

import { clamp, smootherstep, toLogFraction, wrapSigned } from "@horizon/toolkit/math";

import { viewById, worldDistance, type Realm, type ViewId } from "../model/views";
import type { OrreryStore } from "../store";
import { closeUpLimits } from "./close-up-flight";
import { GALAXY_NEAR, SOLAR_EDGE } from "./kit";
import { GALAXY_FRAME, LY, galacticAnchor, galaxyMix, galaxyToWorld, realmOf } from "./lod";

/** What the rig needs to know about a close-up in progress. */
export type CloseUpFrame = { phase: "in" | "on" | "out"; radius: number; frame: number };

export type CameraRig = ReturnType<typeof createCameraRig>;

/** Zoom spring rates (1/s): wheel steps glide into each other, pinches track the fingers. */
const WHEEL_RATE = 11;
const PINCH_RATE = 30;
/** Speed (e-folds/s) taken over from another camera owner; a larger jump is a cut. */
const MAX_CARRY = 40;
/** A view flight's length grows with the scales it crosses. */
const flightSeconds = (efolds: number) => clamp(0.9 + 0.2 * Math.abs(efolds), 0.9, 4.5);
/** Seconds for the bulge card to take the aim to the centre or give it back. */
const HOLD_S = 0.8;

type Flight = {
  from: number;
  to: number;
  /** Leaving speed, in log distance per unit of flight progress. */
  lead: number;
  t: number;
  seconds: number;
  /** Between maps the angles fly too: start and signed change. */
  turn: { azimuth: number; dAzimuth: number; inclination: number; dInclination: number } | null;
};

export function createCameraRig(
  camera: PerspectiveCamera,
  options: {
    state: () => OrreryStore;
    reduceMotion: MediaQueryList;
    closeUp: () => CloseUpFrame | null;
  },
) {
  const { state, reduceMotion, closeUp } = options;
  const anchor: [number, number, number] = [0, 0, 0];
  const offset = new Vector3();
  const orbitFrame = new Quaternion();
  const centre = new Vector3();
  /** Log-distance zoom: destination, speed (e-folds/s), spring rate, and the distance last written. */
  const zoom = { target: Math.log(72), speed: 0, rate: WHEEL_RATE, written: 72 };
  let flight: Flight | null = null;
  /** 0..1 of the way the bulge card has taken the aim to the centre. */
  let hold = 0;

  const bulgeHeld = () => {
    const sel = state().selection;
    return sel?.kind === "galaxy" && sel.id === "bulge";
  };

  const rig = {
    pose: { azimuth: 0.6, inclination: 0.52, distance: 72 },
    aim: new Vector3(),
    /** 0 on the solar map … 1 in the Galaxy, from the camera distance. */
    galaxy: 0,
    /** Galaxy camera target: the centre from afar, the Sun up close (0..1 of the way). */
    homing: 0,
    /** Accumulated zoom past a close-up's far limit, in e-folds; a deliberate push leaves. */
    edgePush: 0,
    /** The map that dominates the view. */
    get realm(): Realm {
      return realmOf(rig.galaxy);
    },
    /** A view flight is under way. */
    get flying() {
      return flight !== null;
    },
    /** A flight, a zoom still gliding, or the aim on its way. */
    get moving() {
      return flight !== null || zoom.speed !== 0 || (hold > 0 && hold < 1);
    },
    /** Where the zoom is heading, au. */
    get target() {
      return Math.exp(zoom.target);
    },

    /** Zoom bounds, au. The solar map and the Galaxy are one range. */
    limits() {
      const close = closeUp();
      if (close) {
        /* Around the body once arrived; open while a flight carries the camera. */
        return close.phase === "on"
          ? closeUpLimits(close.radius, close.frame)
          : { min: 1e-12, max: SOLAR_EDGE };
      }
      return {
        /* While the bulge card holds the aim on the centre, stop at the Galaxy map's floor. */
        min: bulgeHeld() ? GALAXY_NEAR * LY : 0.35,
        max: (state().show.halo ? 2_400_000 : 230_000) * LY,
      };
    },

    /** The pose input steps from: the zoom's destination, so wheel notches add up. */
    inputPose() {
      return { ...rig.pose, distance: rig.target };
    },
    /** Input asks for a distance; `direct` (a pinch) follows closely. Keeps the zoom's speed. */
    zoomTo(distance: number, direct: boolean) {
      const bounds = rig.limits();
      const next = clamp(distance, bounds.min, bounds.max);
      flight = null;
      zoom.target = Math.log(next);
      zoom.rate = direct ? PINCH_RATE : WHEEL_RATE;
      /* Reduced motion: the zoom lands at once, as input did before it glided. */
      if (reduceMotion.matches) {
        rig.pose.distance = next;
        rig.settle();
      }
    },
    /** Someone else set the pose outright (a snap, a landing): nothing left to glide. */
    settle() {
      flight = null;
      zoom.target = Math.log(rig.pose.distance);
      zoom.speed = 0;
      zoom.written = rig.pose.distance;
    },
    /** Ends a flight; the zoom glides to rest from its current speed, without turning back. */
    cancel() {
      if (!flight) return;
      flight = null;
      const bounds = rig.limits();
      zoom.target = clamp(
        Math.log(rig.pose.distance) + zoom.speed / zoom.rate,
        Math.log(bounds.min),
        Math.log(bounds.max),
      );
    },

    snapToView(id: ViewId) {
      const view = viewById(id);
      rig.pose.azimuth = view.azimuth ?? 0.6;
      rig.pose.inclination = view.inclination ?? (view.realm === "galaxy" ? 0.58 : 0.52);
      rig.pose.distance = worldDistance(view.dist, view.realm);
      rig.galaxy = galaxyMix(rig.pose.distance);
      rig.settle();
    },
    /** Flies to a view's scale; between maps the angles fly to the view's framing too. */
    flyToView(id: ViewId) {
      const view = viewById(id);
      // Reduced motion: no zoom flight across scales, arrive at once.
      if (reduceMotion.matches) {
        rig.snapToView(id);
        return;
      }
      const from = Math.log(rig.pose.distance);
      const to = Math.log(worldDistance(view.dist, view.realm));
      const crossing = view.realm !== rig.realm;
      if (!crossing && Math.abs(to - from) < 0.012) return;
      const seconds = flightSeconds(to - from);
      const azimuth = view.azimuth ?? 0.6;
      const inclination = view.inclination ?? (view.realm === "galaxy" ? 0.58 : 0.52);
      flight = {
        from,
        to,
        lead: zoom.speed * seconds,
        t: 0,
        seconds,
        turn: crossing
          ? {
              azimuth: rig.pose.azimuth,
              dAzimuth: wrapSigned(azimuth - rig.pose.azimuth, Math.PI * 2),
              inclination: rig.pose.inclination,
              dInclination: inclination - rig.pose.inclination,
            }
          : null,
      };
    },

    /** Advances the flight or the zoom spring; follows other owners of the camera. */
    step(dt: number) {
      const { pose } = rig;
      /* The guide or a close-up moved the camera: carry its speed, unless it cut. */
      if (pose.distance !== zoom.written) {
        const jump = Math.log(pose.distance / zoom.written);
        zoom.speed = dt > 0 && Math.abs(jump) < 0.5 ? clamp(jump / dt, -MAX_CARRY, MAX_CARRY) : 0;
        zoom.target = Math.log(pose.distance);
        flight = null;
      }
      hold = bulgeHeld() ? Math.min(1, hold + dt / HOLD_S) : Math.max(0, hold - dt / HOLD_S);
      const close = closeUp();
      if (close && close.phase !== "on") {
        /* The close-up flight owns the distance. */
        zoom.written = pose.distance;
        return;
      }
      let x = Math.log(pose.distance);
      if (flight) {
        flight.t = Math.min(1, flight.t + dt / flight.seconds);
        const s = flight.t;
        /* Quintic Hermite: leaves at the zoom's speed, lands at rest, no jerk at either end. */
        const s2 = s * s;
        const land = s2 * s * (10 - 15 * s + 6 * s2);
        const carry = s - 6 * s2 * s + 8 * s2 * s2 - 3 * s2 * s2 * s;
        const landRate = 30 * s2 * (1 - s) * (1 - s);
        const carryRate = 1 - 18 * s2 + 32 * s2 * s - 15 * s2 * s2;
        const gap = flight.to - flight.from;
        x = flight.from + gap * land + flight.lead * carry;
        zoom.speed = (gap * landRate + flight.lead * carryRate) / flight.seconds;
        zoom.target = x;
        if (flight.turn) {
          const k = smootherstep(s);
          pose.azimuth = flight.turn.azimuth + flight.turn.dAzimuth * k;
          pose.inclination = flight.turn.inclination + flight.turn.dInclination * k;
        }
        if (s >= 1) {
          x = flight.to;
          zoom.target = x;
          zoom.speed = 0;
          flight = null;
        }
      } else {
        /* Limits can move under the zoom (the halo switched off, the bulge card held): glide back. */
        const bounds = close ? null : rig.limits();
        if (bounds) zoom.target = clamp(zoom.target, Math.log(bounds.min), Math.log(bounds.max));
      }
      if (!flight && (zoom.speed !== 0 || x !== zoom.target)) {
        /* Critically damped spring toward the target, solved exactly for this step. */
        const w = zoom.rate;
        const gap = x - zoom.target;
        const decay = Math.exp(-w * dt);
        const push = (zoom.speed + w * gap) * dt;
        x = zoom.target + (gap + push) * decay;
        zoom.speed = (zoom.speed - w * push) * decay;
        if (Math.abs(x - zoom.target) < 1e-4 && Math.abs(zoom.speed) < 1e-3) {
          x = zoom.target;
          zoom.speed = 0;
        }
      }
      pose.distance = Math.exp(x);
      zoom.written = pose.distance;
    },

    /** Close in, the camera turns about the Sun; far out, about the galactic centre. */
    home() {
      const s = state();
      galacticAnchor(s.yearsAgo, s.show.elliptical, anchor);
      galaxyToWorld(0, 0, 0, anchor, centre);
      rig.homing =
        smootherstep(1 - toLogFraction(rig.pose.distance / LY, 9_000, 40_000)) *
        (1 - smootherstep(hold));
      rig.aim.copy(centre).multiplyScalar(1 - rig.homing);
    },

    applyPose() {
      const { pose, aim } = rig;
      const { azimuth, inclination, distance } = pose;
      rig.galaxy = galaxyMix(distance);
      /* The orbit frame turns from the ecliptic to the galactic plane over the handoff. */
      orbitFrame.identity().slerp(GALAXY_FRAME, rig.galaxy);
      offset
        .set(
          distance * Math.cos(inclination) * Math.sin(azimuth),
          distance * Math.sin(inclination),
          distance * Math.cos(inclination) * Math.cos(azimuth),
        )
        .applyQuaternion(orbitFrame);
      camera.position.copy(aim).add(offset);
      camera.up.set(0, 1, 0).applyQuaternion(orbitFrame);
      camera.lookAt(aim);
      /* The main pass; the Galaxy pass fits its own range. */
      camera.near = Math.max(0.008, distance / 5000);
      /* In a close-up this frustum draws the rest of the system; the body gets its own pass. */
      camera.far = closeUp() ? Math.max(distance * 40, aim.length() * 2 + 60) : distance * 40;
      camera.updateProjectionMatrix();
      /* Labels are projected before the renderer refreshes these; keep them on this frame's pose. */
      camera.updateMatrixWorld();
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    },
  };
  return rig;
}
