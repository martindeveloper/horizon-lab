/**
 * The Voyage renderer, on the toolkit's scene host with a logarithmic depth buffer: one pass
 * from a moon's surface to the far planets. The ship is the scene's origin; the bodies layer
 * places every body by its offset from the ship in doubles each frame. Frames are rendered
 * only while something moves (a flight, a gesture, the clocks running, a map arriving) or a
 * store change made the picture stale, so a parked ship with its clocks held costs no GPU time.
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
import { createMapBudget } from "@/space/solar-system/scene/map-budget";
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

import { blackbodyTexture } from "../graphics/looks";
import { anchorAt, isBodyAnchor } from "../model/anchors";
import { bodyPositionKm, radiusKm } from "../model/bodies";
import { dateAt } from "../model/calendar";
import { scaleFactorAt } from "../model/comoving";
import { C_KM_S, COSMIC_FAR_KM, DRIVES, NEAR_PLANE_KM, irradianceAt } from "../model/parameters";
import { createShipMotion, shipMotion } from "../model/ship";
import { voyageQuality } from "../quality";
import { READOUTS, useVoyage, type Readouts } from "../store";
import { createAlphaCentauriLayer } from "./alpha-centauri-layer";
import { createBodiesLayer } from "./bodies-layer";
import { createCmbLayer } from "./cmb-layer";
import { createCockpit } from "./cockpit";
import { createGuideDirector } from "./guide-director";
import { createHud } from "./hud";
import { labelInsets, type Frame, type VoyageKit } from "./kit";
import { createLod } from "./lod";
import { createPicking } from "./picking";
import { createShipCamera } from "./ship-camera";
import { createStarsLayer } from "./stars-layer";
import { GALAXY_LAYER, createWorldsLayer } from "./worlds-layer";

/** Beyond this far from its aim a flight is cruising: map uploads may take whole frames. */
const CRUISE_KM = 50_000;
/** Frames per second while only the clocks run (the planets creep): enough for a glide. */
const CLOCK_FPS = 30;
const TIGHT_CLOCK_FPS = 24;

export function createVoyageEngine({
  canvas,
  host,
  labelRoot,
  labels,
  locale,
  onError,
}: SceneMount): SimulationEngine {
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
    const cmb = createCmbLayer(kit, scene, lut);
    const stars = createStarsLayer(kit, scene, lut, quality.sky);
    const bodies = createBodiesLayer(kit, scene, { place, globe: quality.globe });
    const alphaCen = createAlphaCentauriLayer(kit, scene, lut, { place });
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
        const gap = distanceVec3d(at, bodies.positionOf(body)) - radiusKm(body);
        return alphaCen.gap(at) < gap ? "alphaCen" : body;
      },
      halfTan,
      /* Space parks a free ship; parked, it holds the clocks (the overlay's). */
      isShortcut: (event) =>
        isSceneShortcut(event) && (event.code !== "Space" || ship.mode === "free"),
      invalidate: () => engine.invalidate(),
      onInput: () => guide.takeOver(),
      onMode: (mode) => {
        lastMode = mode;
        if (store.getState().mode !== mode) store.setState({ mode });
      },
    });
    ship.setDrive(DRIVES[store.getState().drive]);
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
    });

    createPicking(kit, canvas, store, {
      pickables: [...bodies.pickables, ...alphaCen.pickables, ...worlds.pickables],
      blocked: () => ship.flying,
      labels: () => hits((key) => worlds.pick(key) !== undefined),
      labelPick: (key) => worlds.pick(key),
      layers: [GALAXY_LAYER],
    });

    let lastPilot = store.getState().pilot;
    const bridge = bridgeStore(store, scope, {
      invalidate: () => engine.invalidate(),
      before: (s) => {
        ship.setDrive(DRIVES[s.drive]);
        if (s.pilot !== lastPilot) {
          lastPilot = s.pilot;
          ship.pilot(s.pilot);
        }
        if (s.mode !== lastMode) {
          lastMode = s.mode;
          ship.setMode(s.mode);
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
      if (next.globe !== quality.globe) bodies.setGlobe(next.globe);
      if (next.cosmos !== quality.cosmos) worlds.setDetail(next.cosmos);
      if (next.sky !== quality.sky) stars.setCounts(next.sky);
      quality = next;
      budget.refilter();
      engine.invalidate();
    });
    invalidateOnMotionChange(scope, engine, reduceMotion);

    const earth = vec3d();
    const aimPos = vec3d();
    const aimRel = vec3d();
    const relVel = vec3d();
    const motion = createShipMotion();
    const shipKm = vec3d();
    const readouts: Readouts = { ...READOUTS, aim: ship.aim, shipKm, epochMs: epoch };
    /* One frame, rewritten each tick; the ship's position is the ship's own array. */
    const frame: Frame = {
      now,
      show: store.getState().show,
      sel: null,
      ship: ship.ship.x,
      aim: ship.destination,
      motion,
    };
    let mapsWaiting = false;
    let clocksRunning = false;

    const continuous = () =>
      ship.moving || clocksRunning || mapsWaiting || lod.busy || worlds.busy || looks.step(0);

    const tick = (dt: number, invalidated: boolean) =>
      bridge.frame(() => {
        const state = store.getState();
        clocksRunning = state.compression > 0 && !ship.flying;
        ship.step(dt, state.compression);
        guide.step();
        lod.begin(dt);
        shipMotion(ship.ship, motion);
        const fromSunAu = lengthVec3d(ship.ship.x) / AU_KM;
        const aimKm = ship.aimDistance;
        frame.show = state.show;
        frame.sel = state.selection;
        frame.aim = ship.destination;
        bodies.update(frame);
        alphaCen.update(frame);
        stars.update(ship.ship.x, fromSunAu, motion);
        const expansion = scaleFactorAt(ship.ship.t);
        cmb.update(ship.ship.t, expansion, motion);
        worlds.update(dt, ship.ship.x, aimKm, expansion, state.show, state.selection);
        looks.step(dt);
        flush();
        mapsWaiting = budget.update(dt, lod.need, {
          keep: isBodyAnchor(ship.destination) ? ship.destination : null,
          cruising: ship.flying && aimKm > CRUISE_KM,
        });

        /* The readouts: the clocks, the ship's speed, how far things are, the light here. */
        const x = ship.ship.x;
        bodyPositionKm("earth", now, earth);
        anchorAt(ship.destination, now, aimPos);
        aimRel[0] = aimPos[0] - x[0];
        aimRel[1] = aimPos[1] - x[1];
        aimRel[2] = aimPos[2] - x[2];
        const range = distanceVec3d(x, aimPos);
        const speed = ship.speed;
        /* Free, the ship closes on its aim by its motion relative to it; a flight at the drive's speed. */
        let closing = 0;
        if (ship.mode === "free" && !ship.flying) {
          ship.relativeVelocity(relVel);
          if (range > 0)
            closing =
              -(relVel[0] * aimRel[0] + relVel[1] * aimRel[1] + relVel[2] * aimRel[2]) / range;
        } else if (ship.flying) closing = speed;
        cockpit.update({
          mode: ship.mode,
          flying: ship.flying,
          show: state.show,
          ship: x,
          v: relVel,
          aimId: ship.destination,
          aim: aimRel,
          axes: ship.axes,
        });
        readouts.shipSeconds = ship.ship.tau;
        readouts.earthSeconds = ship.ship.t;
        readouts.speed = speed;
        readouts.gamma = motion.gamma;
        readouts.aim = ship.destination;
        readouts.mode = ship.mode;
        readouts.range = range;
        readouts.closing = closing;
        readouts.fromSun = fromSunAu * AU_KM;
        readouts.lightToEarth = distanceVec3d(x, earth) / C_KM_S;
        readouts.irradiance = irradianceAt(Math.max(lengthVec3d(x), 1));
        readouts.flying = ship.flying;
        readouts.cmbKelvin = cmb.kelvin;
        shipKm[0] = x[0];
        shipKm[1] = x[1];
        shipKm[2] = x[2];
        hud.update(dt, invalidated, { distance: aimKm / AU_KM, angles: ship.pose }, readouts);

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
        if (ship.moving || mapsWaiting || lod.busy || worlds.busy) return quality.resolution.fps;
        return Math.min(quality.resolution.fps, tight ? TIGHT_CLOCK_FPS : CLOCK_FPS);
      },
    });
    engine.refresh();
  });
}
