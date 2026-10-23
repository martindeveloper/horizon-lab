/**
 * The Deep Field renderer, on the toolkit's scene host (renderer, camera, frame loop), orbit
 * rig and controls, with the store bridged by `bridgeStore`. Frames are rendered only while
 * something moves (a flight, a glide, a drag, a fade) or a store change made the picture
 * stale, so an idle view costs no GPU time.
 *
 * Each layer builds its objects once and draws one `Frame`; this file wires them to the
 * store, the camera, input and the level of detail (`@/space/galaxy/scene/lod`): one world in
 * au, the Galaxy and the cosmic map (the shared worlds, `@/space/galaxy` and `@/space/cosmos`)
 * drawn in a pass of their own, then the solar system (the shared unit, held at today), a
 * close-up body over it, then its reach and the nearest stars over them.
 */
import { Scene } from "three";

import {
  bridgeHandoff,
  bridgeRender,
  bridgeStore,
  invalidateOnMotionChange,
  lendCamera,
  orbitCamera,
  stageClearance,
} from "@/lib/scene-bridge";
import { TAP_STYLE } from "@/space/close-up-flight";
import { createCosmosLayer } from "@/space/cosmos/scene/cosmos-layer";
import { haloVisibility } from "@/space/galaxy/model/dark-halo";
import { NEIGHBOURS } from "@/space/galaxy/model/neighbours";
import { GALAXY_LAYER, LY, galaxyMix } from "@/space/galaxy/scene/frames";
import { createGalaxyLayer } from "@/space/galaxy/scene/galaxy-layer";
import { createLabelPicks } from "@/space/galaxy/scene/label-picks";
import { createLod } from "@/space/galaxy/scene/lod";
import { createNeighboursLayer } from "@/space/galaxy/scene/neighbours-layer";
import { TODAY } from "@/space/solar-system/model/moment";
import { positionOf } from "@/space/solar-system/model/position";
import { PROBES, probePosition, yearOf, type ProbeId } from "@/space/solar-system/model/probes";
import { isSolarSelection } from "@/space/solar-system/model/selection";
import { createCloseUp, solarCloseUpTargets } from "@/space/solar-system/scene/close-up";
import { createSolarKit, type SolarFrame, type SolarShow } from "@/space/solar-system/scene/kit";
import { createProbeCrafts } from "@/space/solar-system/scene/probe-crafts";
import { createReachLayer, type ReachFrame } from "@/space/solar-system/scene/reach-layer";
import {
  SOLAR_RULER_KEYS,
  createSolarSystem,
  rulerOrigin,
  solarLabelPick,
} from "@/space/solar-system/scene/solar-system";
import type { Vec3 } from "@horizon/toolkit/bodies";
import { REDUCED_MOTION_QUERY, WIDE_QUERY } from "@horizon/toolkit/environment";
import { withScope, type SimulationEngine } from "@horizon/toolkit/rendering";
import {
  SOLAR_GOLD,
  createAnchoredRulers,
  createDistanceText,
  createLabels,
  createLineVeil,
  createOrbitControls,
  createSceneHost,
  sceneKit,
  type SceneMount,
} from "@horizon/toolkit/scene";
import { AU_KM } from "@horizon/toolkit/science";

import { createLooks } from "../graphics/looks";
import { LADDER_LY } from "../model/depth";
import { viewById, worldDistance, type Realm } from "../model/views";
import { deepFieldQuality } from "../quality";
import { dropsSelection, useDeepField, type DeepFieldCloseUp } from "../store";
import { createCameraRig } from "./camera-rig";
import { createDriftDirector } from "./drift-director";
import { createGuideDirector } from "./guide-director";
import { createHud } from "./hud";
import { SOLAR_SHOW, labelInsets, type Frame, type SceneKit } from "./kit";
import { createPicking } from "./picking";
import { createProbeCloseUp } from "./probe-close-up";
import { createSkyLayer } from "./sky-layer";

export function createDeepFieldEngine({
  canvas,
  host,
  labelRoot,
  labels,
  locale,
  onError,
}: SceneMount): SimulationEngine {
  return withScope((scope) => {
    const sceneHost = createSceneHost(scope, { canvas, host, onError });
    const { renderer, camera, engine, tight, basics, viewport, warmUp } = sceneHost;
    /** The visitor's render quality as Deep Field's settings; `bridgeRender` keeps it current. */
    let quality = deepFieldQuality(useDeepField.getState().quality, tight);
    sceneHost.setResolution(quality.resolution);
    sceneHost.setBloom({ enabled: useDeepField.getState().bloom, ...quality.bloom });
    sceneHost.setLens({ enabled: useDeepField.getState().lens, ...quality.lens });
    const looks = scope.own(createLooks());
    const scene = new Scene();
    const lod = createLod(camera, viewport);
    const kit: SceneKit = sceneKit(basics, looks, lod);

    const store = useDeepField;
    const reduceMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    /* Labels keep clear of the ladder wherever it stands (model/depth.ts). */
    const wide = window.matchMedia(WIDE_QUERY);
    /* The eyepiece publishes its height on the stage, the caption its own; labels and their
       taps keep above them. */
    const dockClear = stageClearance(host, "--hud-clear", 96);
    const captionClear = stageClearance(host, "--caption-clear");

    const rig = createCameraRig(camera, {
      state: () => store.getState(),
      reduceMotion,
      closeUp: () => bodyCloseUp.current,
    });
    const { pose } = rig;
    const { place, flush, hits, hideAll, setBodies } = createLabels(kit, labelRoot, labels, {
      insets: () => labelInsets(wide.matches, dockClear(), captionClear()),
    });
    const distanceText = createDistanceText(labels, () => store.getState().distanceUnit, locale);
    /* Rulers from the selection (or the Sun) to the bodies and probes, or the nearest stars, in view. */
    const rulers = createAnchoredRulers(scope, scene, place, {
      keys: [...SOLAR_RULER_KEYS, ...PROBES.map((p) => p.id), ...NEIGHBOURS.map((n) => n.id)],
      color: SOLAR_GOLD,
      pxWorld: kit.pxWorld,
      distanceText,
    });
    const sky = createSkyLayer(kit, scene);
    /* What a tap on a name opens: the solar system's first, then each layer's own. */
    const picks = createLabelPicks();
    picks.register(solarLabelPick);
    /* The solar system today, on its own looks and level of detail. Deep Field opens on the
       Galaxy: each body's map is painted once the body is drawn. */
    const solarKit = createSolarKit(basics, "whenSeen");
    solarKit.looks.setAirSteps(quality.closeUp.airSteps);
    let surfacesBusy = false;
    const solar = createSolarSystem(solarKit, scene, {
      place,
      hideAll,
      setBodies,
      rulers,
      shownFor: (id) => bodyCloseUp.shownFor(id),
      closeId: () => bodyCloseUp.current?.globe ?? null,
      swarms: quality.swarms,
    });
    const reach = createReachLayer(kit, scene, { place, rulers, picks });
    /* The probes at their true size, after the scene in a depth range of their own. */
    const probes = createProbeCrafts(basics, {
      unitM: AU_KM * 1e3,
      invalidate: () => engine.invalidate(),
    });
    const neighbours = createNeighboursLayer(kit, scene, {
      place,
      rulers,
      labels,
      distanceText,
      picks,
    });
    const galaxy = createGalaxyLayer(kit, scene, { place, rulers, distanceText, picks });
    const cosmos = createCosmosLayer(kit, scene, {
      place,
      rulers,
      distanceText,
      picks,
      detail: quality.cosmos,
      onCmbStatus: (cmbStatus) => store.setState({ cmbStatus }),
      cmbMaxTextureSize: renderer.capabilities.maxTextureSize,
    });
    let cmbRetry = store.getState().cmbRetry;
    const hud = createHud(store, camera, viewport);

    /* The probes and the Earth their dishes face, on the clock's date (`probeYear`). */
    let probeYear = yearOf(new Date());
    const probeAt = (id: ProbeId, out: Vec3) => probePosition(id, probeYear, out);
    const earth: Vec3 = [0, 0, 0];
    /* The camera as the rig holds it: its aim and its exact offset from there. */
    const aimAt: Vec3 = [0, 0, 0];
    const cameraOffset: Vec3 = [0, 0, 0];
    const closeUp = createProbeCloseUp(rig, camera, {
      probeAt,
      reduceMotion,
      /* The drift's visits are its own (`visitStyle`), and wait while it is paused. */
      style: () => (store.getState().drift === "off" ? TAP_STYLE : drift.visitStyle()),
      paused: () => store.getState().drift === "paused",
    });
    /* Rewritten each frame (the clock's date afresh, since a layer may keep it); the layers and
       the close-up read them only while they update. */
    const solarShow: SolarShow = { ...SOLAR_SHOW };
    const solarFrame: SolarFrame = {
      ...TODAY,
      dt: 0,
      now: new Date(),
      show: solarShow,
      sel: null,
      playing: false,
      dist: 0,
    };
    /** Accumulated zoom past a body close-up's far limit, in e-folds; a deliberate push leaves. */
    let edgePush = 0;
    /* A body at its true size: the shared solar close-up, on the bodies as this scene draws them. */
    const bodyCloseUp = createCloseUp(solarKit, {
      rig,
      reduceMotion,
      invalidate: () => engine.invalidate(),
      ...solarCloseUpTargets(
        solar,
        () => TODAY,
        () => solarFrame.now,
      ),
      onTakeCamera: () => {
        controls.cancel();
        edgePush = 0;
      },
      onRelease: () => controls.cancel(),
      upload: (texture) => renderer.initTexture(texture),
      quality: () => quality.closeUp,
    });
    /** The probe a close-up names, for the probe close-up; a body's is the shared one's. */
    const probeWanted = (want: DeepFieldCloseUp | null) =>
      want?.kind === "reach" ? want.id : null;

    /* The handoff and first pose read the rig's close-up state, so its controller must exist. */
    const { view } = store.getState();
    rig.snapToView(view);
    /* Arrived from the Orrery: open where it left off, then settle on this view. Leaving for
       the Orrery while the orbit is still in the ecliptic: it opens at this pose, or, from a
       close-up, at the pose the close-up flew in from. */
    bridgeHandoff(scope, "deep-field", rig, view, {
      leaveAt: () => bodyCloseUp.current?.home ?? (galaxyMix(pose.distance) === 0 ? pose : null),
    });
    rig.home();
    rig.applyPose();

    /* The guided journey and the drift fly their own shots; a drag or a zoom takes the camera back. */
    const guide = createGuideDirector(rig, store, reduceMotion);
    const drift = createDriftDirector(rig, store, { reduceMotion, closeUp });
    /* The drift veils the line art: orbits, rings, trails and rulers fade, the sky stays. */
    const veil = createLineVeil();
    const controls = createOrbitControls(scope, canvas, rig, {
      invalidate: () => engine.invalidate(),
      /* The rig clamps to its own limits, the ladder's ends. */
      distance: { min: LADDER_LY.near * LY * 0.5, max: LADDER_LY.far * LY * 1.1 },
      intercept: (next) => {
        const close = bodyCloseUp.current;
        if (!close) return false;
        /* Flights own the camera; once arrived, a deliberate pull past the far limit leaves. */
        if (close.phase !== "on") return true;
        const far = rig.limits().max;
        if (next.distance > far && rig.target >= far * 0.99) {
          edgePush += Math.log(next.distance / far);
          if (edgePush > 0.45) {
            edgePush = 0;
            store.getState().leaveCloseUp(true);
            return true;
          }
        } else edgePush = 0;
        return false;
      },
      onInput: () => {
        guide.takeOver();
        drift.takeOver();
      },
    });
    const continuous = () =>
      rig.moving ||
      closeUp.busy ||
      bodyCloseUp.busy() ||
      guide.busy ||
      drift.busy ||
      veil.busy ||
      controls.interacting ||
      lod.busy ||
      solarKit.lod.busy ||
      surfacesBusy;

    createPicking(kit, canvas, store, {
      pickables: [
        ...solar.pickables,
        ...reach.pickables,
        ...neighbours.pickables,
        ...galaxy.pickables,
        ...cosmos.pickables,
      ],
      /* Taps are ignored while a body close-up's flight holds the camera. */
      blocked: () => bodyCloseUp.current !== null && bodyCloseUp.current.phase !== "on",
      distance: () => pose.distance,
      labels: () => hits((key) => picks.pick(key) !== undefined),
      labelPick: (key) => picks.pick(key),
    });

    /** What the bridge last acted on besides the view, flight and turn. */
    let lastSeek = store.getState().seek;
    let lastCloseUp = store.getState().closeUp;
    const bridge = bridgeStore(store, scope, {
      invalidate: () => engine.invalidate(),
      before: (s) => {
        if (s.cmbRetry !== cmbRetry) {
          cmbRetry = s.cmbRetry;
          cosmos.retryCmb();
        }
        /* The guide takes the camera. */
        if (s.guideOpen && bodyCloseUp.current) bodyCloseUp.end(false);
        if (s.seek !== lastSeek) {
          lastSeek = s.seek;
          if (!s.seek) return;
          const close = bodyCloseUp.current;
          /* From a close-up, one flight out to the depth the ladder asks for. */
          if (close && !reduceMotion.matches)
            bodyCloseUp.leaveTo({ ...close.home, distance: worldDistance(s.seek.ly) });
          else rig.zoomTo(worldDistance(s.seek.ly), true);
        }
      },
      turn: (turn) => rig.turnBy(turn),
      fly: (s) => {
        /* The journey and the drift fly their own shots. */
        if (s.guideOpen || s.drift !== "off") return;
        /* Leaving a close-up for a view: one flight, out of the body and on to the view. */
        if (bodyCloseUp.current && !reduceMotion.matches) bodyCloseUp.leaveTo(rig.viewPose(s.view));
        else {
          bodyCloseUp.end(false);
          rig.flyToView(s.view);
        }
        controls.cancel();
      },
      after: (s) => {
        /* A body's close-up follows the store: from one to another (the Earth's to the Moon's)
           is one flight; a close-up a drift's start clears ends at once behind its curtain. */
        if (s.closeUp === lastCloseUp) return;
        lastCloseUp = s.closeUp;
        if (s.closeUp && s.closeUp.kind !== "reach") {
          closeUp.end(true);
          bodyCloseUp.start(s.closeUp);
        } else if (s.closeUp || s.drift === "loading") bodyCloseUp.end(true);
        else bodyCloseUp.leave();
      },
    });
    /* The camera as the store borrows it: the same pose across every scale, so home is one flight. */
    scope.defer(
      lendCamera(
        store,
        orbitCamera(rig, () => engine.invalidate()),
      ),
    );
    bridgeRender(store, scope, sceneHost, (level) => {
      const next = deepFieldQuality(level, tight);
      sceneHost.setResolution(next.resolution);
      sceneHost.setBloom({ enabled: store.getState().bloom, ...next.bloom });
      sceneHost.setLens({ enabled: store.getState().lens, ...next.lens });
      solar.setSwarms(next.swarms);
      if (next.cosmos !== quality.cosmos) cosmos.setDetail(next.cosmos);
      quality = next;
      bodyCloseUp.refilter();
      solarKit.looks.setAirSteps(quality.closeUp.airSteps);
      engine.invalidate();
    });
    invalidateOnMotionChange(scope, engine, reduceMotion);

    /**
     * The Galaxy and the cosmic map first, in a depth range fitted to them (their stars and
     * galaxies sit light-years behind the Sun's neighbours), then the neighbourhood over them.
     */
    const draw = () => {
      veil.cover(scene);
      if (galaxy.visible || cosmos.visible) {
        const near = camera.near;
        const far = camera.far;
        camera.far = Math.max(
          galaxy.visible ? galaxy.reach() : 0,
          cosmos.visible ? cosmos.reach() : 0,
        );
        camera.near = Math.max(pose.distance / 5000, camera.far * 1e-7);
        camera.updateProjectionMatrix();
        camera.layers.set(GALAXY_LAYER);
        renderer.render(scene, camera);
        camera.layers.set(0);
        camera.near = near;
        camera.far = far;
        camera.updateProjectionMatrix();
        renderer.autoClear = false;
        renderer.clearDepth();
      }
      renderer.render(scene, camera);
      bodyCloseUp.renderBody(renderer, scene);
      probes.render(renderer);
      renderer.autoClear = true;
      veil.uncover();
    };

    /**
     * The scale that dominated the last frame; a selection from another one is let go. Null
     * at first, so a selection the store kept from an earlier visit is checked on arrival.
     */
    let lastRealm: Realm | null = null;
    const reachFrame: ReachFrame = {
      show: store.getState().show,
      sel: null,
      dist: 0,
      lines: 1,
      year: probeYear,
      approach: null,
    };
    const tick = (dt: number, invalidated: boolean) =>
      bridge.frame(() => {
        const state = store.getState();
        guide.step(dt);
        drift.step(dt);
        veil.step(dt, state.drift === "off");
        /* One date a frame, for the close-up's aim and the probes alike. */
        solarFrame.now = new Date();
        probeYear = yearOf(solarFrame.now);
        /* The drift may have just opened or let go of a visit's close-up. Under its loading
           curtain a close-up ends at once: the drift cuts to its opening shot. */
        const { closeUp: want, drift: drifting } = store.getState();
        if (drifting === "loading" && closeUp.current) closeUp.end();
        closeUp.step(dt, probeWanted(want));
        rig.step(dt);
        rig.home();
        /* After the rig homes its aim: a body's close-up keeps it on the body. */
        bodyCloseUp.step(dt);
        rig.applyPose();
        const dist = pose.distance;
        lod.begin(dt, dist);
        solarKit.lod.begin(dt, dist, rig.target);
        const realm = lod.realm;
        /* Zooming across a scale lets go of a selection from another one, unless a view
           flight is carrying the camera to that scale. The journey picks its own. */
        const isHalo = state.selection?.kind === "galaxy" && state.selection.id === "halo";
        if ((realm !== lastRealm || isHalo) && !state.guideOpen) {
          lastRealm = realm;
          const sel = state.selection;
          const flyingTo = rig.flying
            ? viewById(state.view).realm
            : bodyCloseUp.current
              ? "solar"
              : null;
          const haloVisible = state.show.halo && haloVisibility(dist / LY) > 0.004;
          if (sel && dropsSelection(sel, realm, flyingTo, haloVisible))
            store.getState().select(null);
        }

        const frame: Frame = {
          show: state.show,
          sel: store.getState().selection,
          dist,
          lines: veil.presence,
        };
        solarShow.names = state.show.names;
        solarFrame.dt = dt;
        solarFrame.sel = frame.sel && isSolarSelection(frame.sel) ? frame.sel : null;
        solarFrame.dist = dist;
        sky.update(frame);
        const at = solar.update(solarFrame, bodyCloseUp.current !== null);
        const painting = solarKit.looks.paint(solarKit.lod.need);
        surfacesBusy = solarKit.looks.step(dt) || painting;
        positionOf({ kind: "planet", id: "earth" }, TODAY, solarFrame.now, earth);
        reachFrame.approach = probes.update({
          dt,
          probeAt,
          earth,
          base: rig.aim.toArray(aimAt),
          offset: rig.offset.toArray(cameraOffset),
          approach: closeUp.approach,
        });
        reachFrame.show = frame.show;
        reachFrame.sel = frame.sel;
        reachFrame.dist = dist;
        reachFrame.lines = frame.lines;
        reachFrame.year = probeYear;
        reach.update(reachFrame);
        /* The neighbours fade themselves out past the nearest stars. */
        neighbours.update(frame, pose.azimuth);
        /* Rulers carry their readouts: the drift leaves them out with the rest of the line art. */
        const rulersOn = state.show.distances && state.drift === "off";
        if (rulersOn && realm === "solar")
          rulers.drawFrom(
            frame.sel?.kind === "reach" && frame.sel.id !== "heliopause"
              ? frame.sel.id
              : rulerOrigin(solarFrame.sel, at),
            dist,
          );
        else if (rulersOn && realm === "stars")
          rulers.drawFrom(frame.sel?.kind === "star" ? frame.sel.id : null, dist);
        galaxy.update(frame);
        cosmos.update(frame);
        /* A probe's model or a CMB map the view needs is still streaming in. */
        const sharpening = probes.waiting || cosmos.cmbWaiting;
        if (sharpening !== state.sharpening) store.setState({ sharpening });
        rulers.finish();
        flush();

        hud.update(dt, invalidated || engine.dirty, {
          ly: dist / LY,
          aimLy: rig.aim.length() / LY,
          syncView: !rig.flying && !bodyCloseUp.current && !state.guideOpen,
          angles: pose,
        });
        sceneHost.render(draw);
        if (bridge.ready()) warmUp(scene);
      });

    engine.start({
      render: tick,
      paused: () => !(engine.dirty || continuous()),
      fps: () => quality.resolution.fps,
    });
    engine.refresh();
  });
}
