/**
 * A probe at its true size: the Orrery's close-up flight (`@/space/close-up-flight`), from
 * wherever the ladder holds the camera to a few metres off the probe, three-quarter lit, and
 * back to where it left. The flight holds the rig's aim and distance (`CameraFocus`); landed,
 * the visitor turns and zooms about the probe within its close-up limits. A drift's visit
 * (`@/space/drift-visits`) flies it in its own style and may release the flight out to the
 * drift's next flight, the close-up keeping the probe in view until that flight hands the aim
 * home.
 */
import { Vector3, type PerspectiveCamera } from "three";

import {
  STILL,
  TAP_STYLE,
  aimAt,
  closeUpLimits,
  closeUpPose,
  flightSeconds,
  sampleCloseUp,
  settingOff,
  type CloseUpStyle,
  type FlightMotion,
  type Vec,
} from "@/space/close-up-flight";
import type { VisitFrame } from "@/space/drift-visits";
import { PROBE_SPACECRAFT, type ProbeId } from "@/space/solar-system/model/probes";
import { spacecraftFrame } from "@/space/spacecraft/models";
import type { Vec3 } from "@horizon/toolkit/bodies";
import type { OrbitPose } from "@horizon/toolkit/camera";
import { logFraction } from "@horizon/toolkit/math";
import { AU_KM } from "@horizon/toolkit/science";

import type { CameraFocus, CameraRig } from "./camera-rig";

const M_PER_AU = AU_KM * 1e3;

/** A flight: its poses, where the aim looks off the probe at either end (`aimAt`), and how it goes. */
type Flight = {
  entering: boolean;
  t: number;
  from: OrbitPose;
  to: OrbitPose;
  lookFrom: Vec;
  lookTo: Vec;
  style: CloseUpStyle;
  /** The camera's motion as the flight set off, carried on and eased out (`sampleCloseUp`). */
  motion: FlightMotion;
};

/** A flight out another camera flies (a drift's), landing on `landing`, from `from` and `look`. */
type Released = { landing: OrbitPose; from: number; look: Vec };

const ON: Vec = [0, 0, 0];

export function createProbeCloseUp(
  rig: CameraRig,
  camera: PerspectiveCamera,
  deps: {
    /** Writes a probe's position (au) into `out`. */
    probeAt: (id: ProbeId, out: Vec3) => Vec3;
    reduceMotion: { matches: boolean };
    /** How each flight goes, read as it starts; a visitor's (`TAP_STYLE`) by default. */
    style?: () => CloseUpStyle;
    /** A scripted visit's flights wait while this holds (its drift is paused). */
    paused?: () => boolean;
  },
) {
  const at: Vec3 = [0, 0, 0];
  const focus: CameraFocus = {
    at: new Vector3(),
    limits: { min: 0, max: 0 },
    flying: false,
  };
  /** The store's close-up as last followed. */
  let wanted: ProbeId | null = null;
  /** The probe the close-up is with, heading for or leaving; null once it has ended. */
  let probe: ProbeId | null = null;
  /** The pose and aim the close-up left from, the flight under way, a flight out released. */
  let back: { pose: OrbitPose; aim: Vec } | null = null;
  let flight: Flight | null = null;
  let released: Released | null = null;

  const halfTan = () => {
    const tall = Math.tan((camera.fov * Math.PI) / 360);
    return Math.min(tall, tall * camera.aspect);
  };
  const frameOf = (id: ProbeId) => spacecraftFrame(PROBE_SPACECRAFT[id]) / M_PER_AU;
  const aimNow = (): Vec => [rig.aim.x, rig.aim.y, rig.aim.z];

  /** The aim's look off the probe at `at`, from where it is now. */
  const lookOff = (aim: Vec): Vec => [aim[0] - at[0], aim[1] - at[1], aim[2] - at[2]];

  const pausedFlight = (f: Flight) => f.style.scripted !== null && (deps.paused?.() ?? false);
  /** A flight out is under way, the close-up's own or released to a drift's. */
  const leaving = () => released !== null || flight?.entering === false;

  function fly(entering: boolean, to: OrbitPose, lookFrom: Vec, lookTo: Vec) {
    const style = deps.style?.() ?? TAP_STYLE;
    const motion = settingOff(STILL, entering, style);
    flight = { entering, t: 0, from: { ...rig.pose }, to, lookFrom, lookTo, style, motion };
    focus.flying = true;
    rig.cancel();
  }

  function enter(id: ProbeId) {
    const aim = aimNow();
    back ??= { pose: { ...rig.pose }, aim };
    probe = id;
    released = null;
    const frame = frameOf(id);
    deps.probeAt(id, at);
    fly(true, closeUpPose(at, frame, halfTan(), rig.pose.azimuth), lookOff(aim), ON);
    focus.limits = closeUpLimits(frame, frame);
  }

  /** Flies out to `home` from wherever the camera is. */
  function flyOut(home: { pose: OrbitPose; aim: Vec }) {
    back = home;
    released = null;
    fly(false, home.pose, lookOff(aimNow()), lookOff(home.aim));
  }

  /** Ends the close-up where the camera is, giving the aim and zoom back to the ladder. */
  function end() {
    probe = null;
    back = null;
    flight = null;
    released = null;
    focus.flying = false;
    rig.holdFocus(null);
  }

  return {
    /** The probe the camera is with, heading for or leaving. */
    get approach() {
      return probe;
    },
    get busy() {
      return flight !== null && !pausedFlight(flight);
    },
    /** The close-up in progress, as a drift's visit reads it; null without one. */
    get current(): VisitFrame | null {
      if (!probe) return null;
      if (released) return { phase: "out", released: released.landing };
      return { phase: !flight ? "on" : flight.entering ? "in" : "out", released: null };
    },
    /**
     * Hands the flight out to another camera, which lands on `landing` (a drift's next flight,
     * so the pull away flows on into it): the close-up only keeps the probe in view meanwhile.
     */
    release(landing: OrbitPose) {
      if (!probe || leaving()) return;
      deps.probeAt(probe, at);
      released = { landing: { ...landing }, from: rig.pose.distance, look: lookOff(aimNow()) };
      flight = null;
      focus.flying = true;
    },
    /** A released flight its camera no longer flies: the close-up flies on to the landing itself. */
    reclaim() {
      if (!released || !back) return;
      flyOut({ pose: released.landing, aim: back.aim });
    },
    end,
    /** Follows the store's close-up (`want`) and advances the flight; before the rig homes. */
    step(dt: number, want: ProbeId | null) {
      if (want !== wanted) {
        wanted = want;
        if (want) enter(want);
        else if (probe && back && !leaving()) {
          deps.probeAt(probe, at);
          flyOut(back);
        }
      }
      if (!probe) return;
      deps.probeAt(probe, at);
      if (released && back) {
        /* The other camera moves the pose; the aim slides home as the pull back nears its landing. */
        const { landing, from, look } = released;
        const blend =
          landing.distance === from ? 1 : logFraction(rig.pose.distance, from, landing.distance);
        const home = { look: lookOff(back.aim), distance: landing.distance };
        const aim = aimAt(at, { look, distance: from }, home, rig.pose.distance, blend);
        focus.at.set(aim[0], aim[1], aim[2]);
        rig.holdFocus(focus);
        return;
      }
      if (!flight) {
        focus.at.set(at[0], at[1], at[2]);
        rig.holdFocus(focus);
        return;
      }
      rig.holdFocus(focus);
      const { from, to, style, motion } = flight;
      const advance = pausedFlight(flight) ? 0 : dt;
      flight.t = deps.reduceMotion.matches
        ? 1
        : Math.min(1, flight.t + advance / flightSeconds(flight.entering, style));
      const sample = sampleCloseUp(flight.t, from, to, flight.entering, style.lead, motion);
      Object.assign(rig.pose, sample.pose);
      /* The aim looks off the probe by a share of the distance, so the probe stays in frame
         however far the dive has gone before the pan ends (and the pull back after). */
      const look = aimAt(
        at,
        { look: flight.lookFrom, distance: from.distance },
        { look: flight.lookTo, distance: to.distance },
        sample.pose.distance,
        sample.aim,
        motion.look,
        sample.carry,
      );
      focus.at.set(look[0], look[1], look[2]);
      if (flight.t < 1) return;
      const landed = flight.entering;
      flight = null;
      focus.flying = false;
      rig.settle();
      if (!landed) end();
    },
  };
}
