/**
 * The Voyage renderer, on the toolkit's scene host with a logarithmic depth buffer: one pass
 * from a moon's surface to the edge. The ship is the scene's origin; every layer places what it
 * draws by its offset from the ship in doubles each frame. Frames are rendered only while
 * something moves (a flight, a gesture, the clocks running) or a store change made the picture
 * stale, so a parked ship with its clocks held costs no GPU time.
 */
import { Scene } from "three";

import {
  bridgeRender,
  bridgeStore,
  invalidateOnMotionChange,
  stageClearance,
} from "@/lib/scene-bridge";
import { createLooks } from "@/space/solar-system/graphics/looks";
import { MAP_BASE } from "@/space/solar-system/graphics/maps";
import { REDUCED_MOTION_QUERY } from "@horizon/toolkit/environment";
import { withScope, type SimulationEngine } from "@horizon/toolkit/rendering";
import {
  createDistanceText,
  createLabels,
  createSceneHost,
  distanceVec3d,
  lengthVec3d,
  sceneKit,
  vec3d,
  type SceneMount,
} from "@horizon/toolkit/scene";
import { AU_KM } from "@horizon/toolkit/science";
import { isSceneShortcut } from "@horizon/toolkit/ui";

import { blackbodyTexture, motionUniforms, writeMotion } from "../graphics/looks";
import { createAnchorCache, isBodyAnchor } from "../model/anchors";
import { dateAt } from "../model/calendar";
import { scaleFactorAt } from "../model/comoving";
import { C_KM_S, COSMIC_FAR_KM, DRIVES, NEAR_PLANE_KM, irradianceAt } from "../model/parameters";
import { createShipMotion, shipMotion } from "../model/ship";
import { voyageQuality } from "../quality";
import { READOUTS, useVoyage, type Readouts } from "../store";
import { createAlphaCentauriLayer } from "./alpha-centauri-layer";
import { createBodiesLayer } from "./bodies-layer";
import { createCmbLayer } from "./cmb-layer";
import { createCockpit, type CockpitFrame } from "./cockpit";
import { createShipFeel } from "./feel";
import { createGlobes } from "./globes";
import { createGuideDirector } from "./guide-director";
import { createHud } from "./hud";
import { labelInsets, type Frame, type VoyageKit } from "./kit";
import { createLod } from "./lod";
import { createMapBudget } from "./map-budget";
import { createPicking } from "./picking";
import { createShipCamera } from "./ship-camera";
import { createSpeedLayer } from "./speed-layer";
import { createStarsLayer } from "./stars-layer";
import { GALAXY_LAYER, createWorldsLayer } from "./worlds-layer";

/** Beyond this far from its aim a flight is cruising: map uploads may take whole frames. */
const CRUISE_KM = 50_000;
/** Frames per second while only the clocks run (the planets creep): enough for a glide. */
const CLOCK_FPS = 30;
const TIGHT_CLOCK_FPS = 24;

export type VoyageEngineOptions = {
  /** Ship seconds per real second flown by hand, by height above the nearest surface (km): the bench's fixed warp. */
  warp?: (heightKm: number) => number;
};

export function createVoyageEngine(
  { canvas, host, labelRoot, labels, locale, onError }: SceneMount,
  options: VoyageEngineOptions = {},
): SimulationEngine {
  return withScope((scope) => {
    const sceneHost = createSceneHost(scope, {
      canvas,
      host,
      onError,
      near: NEAR_PLANE_KM,
      far: COSMIC_FAR_KM,
      logarithmicDepth: true,
    });
    const { renderer, camera, engine, tight, basics, viewport, warmUp } = sceneHost;
    const store = useVoyage;
    let quality = voyageQuality(store.getState().quality, tight);
    sceneHost.setResolution(quality.resolution);
    sceneHost.setBloom({ enabled: store.getState().bloom, ...quality.bloom });
    sceneHost.setLens({ enabled: store.getState().lens, ...quality.lens });
    /* Measured maps stream in; bodies wait in their mean colour. Eclipses and fine rings. */
    const looks = scope.own(
      createLooks(tight, true, { occluders: quality.occluders, ringTexels: quality.ringTexels }),
    );
    const scene = new Scene();
    const lod = createLod(camera, viewport, basics.dpr);
    const kit: VoyageKit = sceneKit(basics, looks, lod);
    const reduceMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    const dockClear = stageClearance(host, "--hud-clear", 96);
    const captionClear = stageClearance(host, "--caption-clear");

    const { place, flush, hits, setBodies } = createLabels(kit, labelRoot, labels, {
      insets: () => labelInsets(dockClear(), captionClear()),
    });
    const lut = scope.own(blackbodyTexture());
    /* The ship's motion: written once a frame, read by every shader that sees it. */
    const moving = motionUniforms();
    const globes = createGlobes(scope, quality.globe);
    const cmb = createCmbLayer(kit, scene, lut, moving);
    const stars = createStarsLayer(kit, scene, lut, moving, quality.sky);
    const bodies = createBodiesLayer(kit, scene, { place, globes, motion: moving });
    const dust = createSpeedLayer(kit, scene, lut, moving, quality.streaks);
    const alphaCen = createAlphaCentauriLayer(kit, scene, lut, { place, globes });
    setBodies([...bodies.labelBodies, ...alphaCen.labelBodies]);
    const distanceText = createDistanceText(labels, () => store.getState().distanceUnit, locale);
    const worlds = createWorldsLayer(basics, scene, {
      place,
      labels,
      distanceText,
      detail: quality.cosmos,
    });
    /* The Galaxy and the cosmic map draw on a layer of their own; one pass takes them all. */
    camera.layers.enable(GALAXY_LAYER);

    /** The visit's epoch: the solar system is drawn at the epoch plus Earth's clock. */
    const epoch = Date.now();
    const now = new Date(epoch);
    const dateOf = (t: number) => dateAt(epoch, t, now);
    const anchorAt = createAnchorCache();

    const feel = createShipFeel(camera);

    const halfTan = () => {
      const tall = Math.tan((camera.fov * Math.PI) / 360);
      return Math.min(tall, tall * camera.aspect);
    };
    const ship = createShipCamera(scope, camera, canvas, {
      reduceMotion,
      bodyAt: anchorAt,
      now: () => now,
      clock: dateOf,
      /* The nearest surface: a solar body's, or one of α Centauri's suns. */
      nearest: (at) => {
        const body = bodies.nearest(at);
        const star = alphaCen.nearest(at);
        return star.gap < body.gap ? star.id : body.id;
      },
      ...(options.warp ? { warp: options.warp } : {}),
      halfTan,
      /* Space puts a ship flown by hand into orbit; in orbit, it holds the clocks (the overlay's). */
      isShortcut: (event) =>
        isSceneShortcut(event) && (event.code !== "Space" || ship.mode === "free"),
      invalidate: () => engine.invalidate(),
      onInput: () => guide.takeOver(),
      /* Into orbit, or wrecked, the lever closes. With the ship's feel, the crash lands first. */
      onCrash: (body, speed) => {
        const wreck = () =>
          store.setState({ crash: { body, speed }, throttle: 0, selection: null, panel: "none" });
        if (store.getState().show.feel) feel.impact(speed, wreck);
        else wreck();
      },
      onMode: (mode) => {
        lastMode = mode;
        const s = store.getState();
        if (s.mode !== mode || (mode === "orbit" && s.throttle > 0))
          store.setState(mode === "orbit" ? { mode, throttle: 0 } : { mode });
      },
    });
    ship.setDrive(DRIVES[store.getState().drive]);
    ship.setThrottle(store.getState().throttle);
    ship.setFeel(store.getState().show.feel);
    let lastMode = store.getState().mode;
    const guide = createGuideDirector(ship, store);
    /* The visit opens parked at its place. */
    dateOf(0);
    ship.snapTo(store.getState().destination);

    const budget = createMapBudget(scope, {
      base: MAP_BASE,
      quality: () => quality.maps,
      onShow: (id, texture) => looks.setMeasured(id, texture),
      onRelease: (id) => looks.clearMeasured(id),
      onFail: (id) => looks.setFailed(id),
      upload: (texture) => renderer.initTexture(texture),
      wake: () => engine.invalidate(),
    });

    const hud = createHud(store, camera, viewport);
    const cockpit = createCockpit(scope, host, camera, viewport, {
      reduceMotion,
      distanceText,
      bodies: [...bodies.positions, ...alphaCen.positions],
      words: labels,
      locale,
    });

    createPicking(kit, canvas, store, {
      pickables: [...bodies.pickables, ...alphaCen.pickables, ...worlds.pickables],
      blocked: () => ship.flying,
      labels: () => hits((key) => worlds.pick(key) !== undefined),
      labelPick: (key) => worlds.pick(key),
      layers: [GALAXY_LAYER],
    });

    let lastAbort = store.getState().abort;
    let lastRecovery = store.getState().recoveries;
    /** The store changed since the last frame: the readouts answer at once. */
    let storeChanged = true;
    const bridge = bridgeStore(store, scope, {
      invalidate: () => {
        storeChanged = true;
        engine.invalidate();
      },
      before: (s) => {
        ship.setDrive(DRIVES[s.drive]);
        ship.setThrottle(s.throttle);
        ship.setFeel(s.show.feel);
        if (!s.show.feel) feel.reset();
        if (s.abort !== lastAbort) {
          lastAbort = s.abort;
          ship.disengage();
        }
        if (s.recoveries !== lastRecovery) {
          lastRecovery = s.recoveries;
          ship.recover();
        }
        /*
         * The mode as the store holds it now, not as `s` had it: a disengage or a recovery
         * above sets the mode through the store itself, and the stale one would undo it.
         */
        const { mode } = store.getState();
        if (mode !== lastMode) {
          lastMode = mode;
          ship.setMode(mode);
        }
      },
      turn: (turn) => ship.turnBy(turn),
      fly: (s) => {
        ship.flyTo(s.destination);
        if (isBodyAnchor(s.destination)) budget.prefetch(s.destination, quality.maps.allow);
      },
    });
    bridgeRender(store, scope, sceneHost, (level) => {
      const next = voyageQuality(level, tight);
      sceneHost.setResolution(next.resolution);
      sceneHost.setBloom({ enabled: store.getState().bloom, ...next.bloom });
      sceneHost.setLens({ enabled: store.getState().lens, ...next.lens });
      if (next.globe !== quality.globe)
        globes.setFinest(next.globe, [...bodies.pickables, ...alphaCen.pickables]);
      if (next.cosmos !== quality.cosmos) worlds.setDetail(next.cosmos);
      if (next.sky !== quality.sky) stars.setCounts(next.sky);
      if (next.streaks !== quality.streaks) dust.setCount(next.streaks);
      quality = next;
      budget.refilter();
      engine.invalidate();
    });
    invalidateOnMotionChange(scope, engine, reduceMotion);

    const earth = vec3d();
    const aimPos = vec3d();
    const aimRel = vec3d();
    const relVel = vec3d();
    const still = vec3d();
    const motion = createShipMotion();
    const readouts: Readouts = { ...READOUTS, aim: ship.destination, epochMs: epoch };
    /* One frame, rewritten each tick; the ship's position is the ship's own array. */
    const frame: Frame = {
      now,
      show: store.getState().show,
      sel: null,
      ship: ship.ship.x,
      aim: ship.destination,
      motion,
    };
    /* The cockpit's frame, rewritten each tick; its vectors are the engine's own. */
    const instruments: CockpitFrame = {
      dt: 0,
      speed: 0,
      closing: 0,
      range: 0,
      mode: ship.mode,
      drive: store.getState().drive,
      flying: false,
      crashed: false,
      phase: null,
      show: store.getState().show,
      spool: 0,
      ship: ship.ship.x,
      v: relVel,
      aimId: ship.destination,
      aim: aimRel,
      axes: ship.axes,
    };
    let clocksRunning = false;
    /* This frame's figures the cockpit draws and the readouts publish. */
    let speed = 0;
    let range = 0;
    let closing = 0;

    /** The readouts, filled only when the HUD publishes: Earth's light-time, the light, the pull. */
    const read = () => {
      const x = ship.ship.x;
      anchorAt("earth", now, earth);
      const fromSun = lengthVec3d(x);
      const pull = ship.readGravity();
      readouts.shipSeconds = ship.ship.tau;
      readouts.earthSeconds = ship.ship.t;
      readouts.speed = speed;
      readouts.gamma = motion.gamma;
      readouts.aim = ship.destination;
      readouts.range = range;
      readouts.closing = closing;
      readouts.fromSun = fromSun;
      readouts.lightToEarth = distanceVec3d(x, earth) / C_KM_S;
      readouts.irradiance = irradianceAt(Math.max(fromSun, 1));
      readouts.flying = ship.flying;
      readouts.phase = ship.phase;
      readouts.regime = dust.regime;
      readouts.warp = ship.warp;
      readouts.gravity = pull.gravity;
      readouts.gravityFrom = pull.from;
      readouts.cmbKelvin = cmb.kelvin;
      return readouts;
    };

    const continuous = () =>
      ship.moving ||
      clocksRunning ||
      feel.busy ||
      lod.busy ||
      worlds.busy ||
      cockpit.settling ||
      looks.step(0);

    const tick = (dt: number) =>
      bridge.frame(() => {
        const state = store.getState();
        const { feel: feeling } = state.show;
        clocksRunning = state.compression > 0 && !ship.flying;
        /* An impact holds the ship's world a moment; the rest of the frame runs on. */
        const shipDt = feel.step(dt);
        ship.step(shipDt, state.compression);
        const { phase } = ship;
        const spool = feeling ? feel.spool(phase, ship.flightSeconds) : 0;
        if (feeling) {
          const axes = ship.axes;
          const drive = ship.flying
            ? phase === "align"
              ? spool
              : phase === "cruise"
                ? 0
                : 1
            : ship.mode === "free"
              ? axes.boost * Math.min(1, Math.abs(axes.thrust))
              : 0;
          feel.apply(dt, drive, reduceMotion.matches);
        }
        guide.step();
        lod.begin(dt);
        shipMotion(ship.ship, motion);
        writeMotion(moving, motion);
        const x = ship.ship.x;
        /* Where the aim is from the ship: the range the HUD, the cockpit and the worlds read. */
        anchorAt(ship.destination, now, aimPos);
        aimRel[0] = aimPos[0] - x[0];
        aimRel[1] = aimPos[1] - x[1];
        aimRel[2] = aimPos[2] - x[2];
        range = lengthVec3d(aimRel);
        frame.show = state.show;
        frame.sel = state.selection;
        frame.aim = ship.destination;
        bodies.update(frame);
        alphaCen.update(frame);
        stars.update(x, lengthVec3d(x) / AU_KM);
        const expansion = scaleFactorAt(ship.ship.t);
        cmb.update(ship.ship.t, expansion, motion);
        worlds.update(dt, x, range, expansion, state.show, state.selection);
        looks.step(dt);
        flush();
        budget.update(dt, lod.need, {
          keep: isBodyAnchor(ship.destination) ? ship.destination : null,
          cruising: ship.flying && range > CRUISE_KM,
        });

        speed = ship.speed;
        /* Free, the ship closes on its aim by its motion relative to it; a flight at the drive's speed. */
        closing = 0;
        if (ship.mode === "free" && !ship.flying) {
          ship.relativeVelocity(relVel);
          if (range > 0)
            closing =
              -(relVel[0] * aimRel[0] + relVel[1] * aimRel[1] + relVel[2] * aimRel[2]) / range;
        } else if (ship.flying) closing = speed;
        /* The dust shows the ship's motion through the near body's frame, at the warp it is seen at. */
        const streaming = ship.flying
          ? ship.phase !== "align"
          : ship.mode === "free" && !ship.crashed;
        const heading = ship.flying ? ship.ship.u : ship.mode === "free" ? relVel : still;
        dust.update(shipDt, streaming && state.show.streaks, heading, ship.warp, motion);
        instruments.dt = dt;
        instruments.speed = speed;
        instruments.closing = closing;
        instruments.range = range;
        instruments.mode = ship.mode;
        instruments.drive = state.drive;
        instruments.flying = ship.flying;
        instruments.crashed = ship.crashed;
        instruments.phase = phase;
        instruments.spool = spool;
        instruments.show = state.show;
        instruments.aimId = ship.destination;
        instruments.axes = ship.axes;
        cockpit.update(instruments);
        hud.update(dt, storeChanged, { distance: range / AU_KM, ship: x, angles: ship.pose }, read);
        storeChanged = false;

        sceneHost.render(() => renderer.render(scene, camera));
        if (bridge.ready()) {
          warmUp(scene);
          budget.start();
        }
      });

    engine.start({
      render: tick,
      paused: () => !(engine.dirty || continuous()),
      fps: () => {
        if (ship.moving || lod.busy || worlds.busy) return quality.resolution.fps;
        return Math.min(quality.resolution.fps, tight ? TIGHT_CLOCK_FPS : CLOCK_FPS);
      },
    });
    engine.refresh();
  });
}
