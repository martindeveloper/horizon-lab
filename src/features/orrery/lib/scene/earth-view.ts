/**
 * The view from Earth (model/earth-view.ts) in the scene: the camera's aim eases from the Sun
 * to Earth and back, and the Sun and the planets trail the paths they draw as seen from Earth
 * over the last years, newest brightest, in their orbits' colours. Each trail keeps its samples
 * in a ring (`createTrailRing`) that grows by one as the clock passes each step.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  Vector3,
  type Object3D,
} from "three";

import { TODAY, type SolarMoment } from "@/space/solar-system/model/moment";
import {
  ORBIT_COLOR,
  type ShownFor,
  type SolarFrame,
  type SolarKit,
} from "@/space/solar-system/scene/kit";
import type { Vec3 } from "@horizon/toolkit/bodies";
import type { OrbitPose } from "@horizon/toolkit/camera";
import { smootherstep } from "@horizon/toolkit/math";
import { SOLAR_GOLD, framed } from "@horizon/toolkit/scene";

import {
  TRAIL_IDS,
  TRAIL_SAMPLES,
  createTrailRing,
  earthAt,
  trailPoint,
  trailReach,
  trailStep,
} from "../model/earth-view";

/** Seconds the aim takes from the Sun to Earth, or back. */
const AIM_S = 0.8;
/** A trail at its newest, before the framing rule and the close-up fade. */
const TRAIL_OPACITY = 0.55;
/** How far the Sun-centred orbit lines dim with Earth at the centre, so the trails read. */
const ORBITS_GIVE_WAY = 0.7;
/** Points drawn: the samples, then the body's exact place this frame. */
const POINTS = TRAIL_SAMPLES + 1;

/** The clock a frame draws at: Neptune's migration and the Motion offset. */
type Clock = Pick<SolarMoment, "mig" | "driftYears">;

export type EarthView = ReturnType<typeof createEarthView>;

export function createEarthView(
  kit: SolarKit,
  parent: Object3D,
  deps: { reduceMotion: { matches: boolean }; shownFor: ShownFor },
) {
  const { scope } = kit;
  /** 0 with the aim on the Sun, 1 on Earth. */
  let mix = 0;
  let target = 0;
  /** Where Earth is this frame. */
  const earth = new Vector3();
  const at: Vec3 = [0, 0, 0];
  const camera = new Vector3();
  const built = new Date();

  const trails = TRAIL_IDS.map((id) => {
    const positions = new Float32Array(POINTS * 3);
    const colors = new Float32Array(POINTS * 3);
    /* Older is fainter: the light adds up where the loops cross. */
    for (let k = 0; k < POINTS; k += 1) {
      const b = (k / TRAIL_SAMPLES) ** 1.5;
      colors[k * 3] = colors[k * 3 + 1] = colors[k * 3 + 2] = b;
    }
    const geometry = scope.own(new BufferGeometry());
    const position = new BufferAttribute(positions, 3);
    geometry.setAttribute("position", position);
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    const material = scope.own(
      new LineBasicMaterial({
        color: id === "sun" ? SOLAR_GOLD : ORBIT_COLOR[id],
        vertexColors: true,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    const line = new Line(geometry, material);
    line.frustumCulled = false;
    line.visible = false;
    parent.add(line);
    return {
      id,
      line,
      material,
      position,
      positions,
      ring: createTrailRing(trailStep(id)),
      /* The reach barely moves over the ephemeris's era: today's serves the framing rule. */
      reach: trailReach(id, TODAY.mig, built),
      /** The clock the points were last written at. */
      drawnAt: NaN,
    };
  });
  type Trail = (typeof trails)[number];

  /** Brings a trail's ring up to the clock and draws it, with the body's exact place at its head. */
  const draw = (trail: Trail, { mig, driftYears }: Clock, now: Date) => {
    if (trail.drawnAt === driftYears) {
      return;
    }
    trail.drawnAt = driftYears;
    const { id, positions } = trail;
    trail.ring.advance(driftYears, (clock, out) => trailPoint(id, mig, clock, now, out));
    /* Oldest first, so the colour ramp runs the right way; the exact place this frame last. */
    trail.ring.read(positions);
    trailPoint(id, mig, driftYears, now, at);
    positions[TRAIL_SAMPLES * 3] = at[0];
    positions[TRAIL_SAMPLES * 3 + 1] = at[1];
    positions[TRAIL_SAMPLES * 3 + 2] = at[2];
    trail.position.needsUpdate = true;
  };

  return {
    /** The aim is on its way between the Sun and Earth. */
    get busy() {
      return mix !== target;
    },
    /**
     * Each frame before the rig places its aim: eases toward Earth (`on`) or the Sun, unless
     * `held` (a close-up owns the aim; the move waits for its landing), and finds Earth.
     */
    step(dt: number, clock: Clock, now: Date, { on, held }: { on: boolean; held: boolean }) {
      target = on ? 1 : 0;
      if (!held) {
        if (deps.reduceMotion.matches) {
          mix = target;
        } else if (target > mix) {
          mix = Math.min(target, mix + dt / AIM_S);
        } else {
          mix = Math.max(target, mix - dt / AIM_S);
        }
      }
      earth.fromArray(earthAt(clock.mig, clock.driftYears, now, at));
    },
    /** How much of the Sun-centred orbit lines to draw: they give way as Earth takes the centre. */
    get orbits() {
      return 1 - ORBITS_GIVE_WAY * smootherstep(mix);
    },
    /** Places the rig's aim: the Sun, Earth, or on the way between. */
    place(aim: Vector3) {
      aim.copy(earth).multiplyScalar(smootherstep(mix));
    },
    /**
     * A pose about the Sun that keeps the camera where `pose` (about this frame's aim) has it:
     * what a host turning about the Sun opens on, so a hand-off never jumps.
     */
    aboutSun(pose: OrbitPose): OrbitPose {
      const k = smootherstep(mix);
      if (k === 0) {
        return pose;
      }
      const { azimuth, inclination, distance } = pose;
      camera
        .set(
          distance * Math.cos(inclination) * Math.sin(azimuth),
          distance * Math.sin(inclination),
          distance * Math.cos(inclination) * Math.cos(azimuth),
        )
        .addScaledVector(earth, k);
      const far = camera.length();
      return {
        distance: far,
        azimuth: Math.atan2(camera.x, camera.z),
        inclination: Math.asin(camera.y / far),
      };
    },
    /** Draws the trails for a frame, each as far as the framing rule and its close-up show it. */
    update(frame: SolarFrame) {
      const shown = frame.present ? smootherstep(mix) : 0;
      for (const trail of trails) {
        const { near, far } = trail.reach;
        const drawn = shown * framed(near, far, frame.dist) * deps.shownFor(trail.id);
        trail.line.visible = drawn > 0.004;
        if (!trail.line.visible) {
          continue;
        }
        trail.material.opacity = TRAIL_OPACITY * drawn;
        trail.line.position.copy(earth);
        draw(trail, frame, frame.now);
      }
    },
  };
}
