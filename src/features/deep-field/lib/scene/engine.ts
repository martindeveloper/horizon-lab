/**
 * The Deep Field renderer, on the toolkit's scene host (renderer, camera, frame loop), orbit
 * rig and controls, with the store bridged by `bridgeStore`. Frames are rendered only while
 * something moves (a flight, a glide, a drag, a fade) or a store change made the picture
 * stale, so an idle view costs no GPU time.
 *
 * Each layer builds its objects once and draws one `Frame`; this file wires them to the
 * store, the camera, input and the level of detail (lod.ts): one world in au, the Galaxy and
 * the cosmic map drawn in a pass of their own, then the solar system (the shared unit, held at
 * today) and the nearest stars over them.
 */
import { Scene } from "three";

import { carryPose, takeHandoff } from "@/lib/handoff";
import { bridgeAntialias, bridgeStore } from "@/lib/scene-bridge";
import { TODAY } from "@/space/solar-system/model/moment";
import { isSolarSelection } from "@/space/solar-system/model/selection";
import { createSolarKit, type SolarFrame } from "@/space/solar-system/scene/kit";
import {
  SOLAR_RULER_KEYS,
  createSolarSystem,
  rulerOrigin,
  solarLabelPick,
} from "@/space/solar-system/scene/solar-system";
import { REDUCED_MOTION_QUERY } from "@horizon/toolkit/environment";
import { DisposalScope } from "@horizon/toolkit/rendering";
import {
  SOLAR_GOLD,
  createAnchoredRulers,
  createDistanceText,
  createLabels,
  createOrbitControls,
  createSceneHost,
  type SceneMount,
} from "@horizon/toolkit/scene";

import { createLooks } from "../graphics/looks";
import { LADDER_LY, LADDER_SIDE_QUERY } from "../model/depth";
import { NEIGHBOURS } from "../model/neighbours";
import { PROBES } from "../model/probes";
import { viewById, worldDistance, type Realm } from "../model/views";
import { dropsSelection, useDeepField, type Selection } from "../store";
import { createCameraRig } from "./camera-rig";
import { createCosmosLayer } from "./cosmos-layer";
import { createGalaxyLayer } from "./galaxy-layer";
import { createGuide } from "./guide";
import { createHud } from "./hud";
import { SOLAR_SHOW, labelInsets, type Frame, type SceneKit } from "./kit";
import { GALAXY_LAYER, LY, createLod, galaxyMix } from "./lod";
import { createNeighboursLayer } from "./neighbours-layer";
import { createPicking } from "./picking";
import { createReachLayer } from "./reach-layer";
import { createSkyLayer } from "./sky-layer";

export type DeepFieldEngine = { dispose: () => void };

export function createDeepFieldEngine({
  canvas,
  host,
  labelRoot,
  labels,
  locale,
  onError,
}: SceneMount): DeepFieldEngine {
  const scope = new DisposalScope();
  try {
    const sceneHost = createSceneHost(scope, { canvas, host, onError });
    const { renderer, camera, engine, tight, basics, viewport, warmUp } = sceneHost;
    const looks = scope.own(createLooks());
    const scene = new Scene();
    const lod = createLod(camera, viewport);
    const kit: SceneKit = { ...basics, looks, lod, pxWorld: lod.pxWorld };

    const store = useDeepField;
    const reduceMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    /* Labels keep clear of the ladder wherever it stands (model/depth.ts). */
    const wide = window.matchMedia(LADDER_SIDE_QUERY);
    /* The eyepiece publishes its height on the stage; labels and their taps keep above it. */
    const stage = host.closest<HTMLElement>("[data-simulation]");
    const clearOf = (property: string) =>
      parseFloat(stage?.style.getPropertyValue(property) ?? "") || 0;
    const dockClear = () => clearOf("--hud-clear") || 96;

    const rig = createCameraRig(camera, { state: () => store.getState(), reduceMotion });
    const { pose } = rig;
    const { place, flush, hits, hideAll, setBodies } = createLabels(kit, labelRoot, labels, {
      insets: () => labelInsets(wide.matches, dockClear(), clearOf("--caption-clear")),
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
    /* The solar system today, on its own looks and level of detail. */
    const solarKit = createSolarKit(basics);
    const solar = createSolarSystem(solarKit, scene, { place, hideAll, setBodies, rulers });
    const reach = createReachLayer(kit, scene, { place, rulers });
    const neighbours = createNeighboursLayer(kit, scene, { place, rulers, labels, distanceText });
    const galaxy = createGalaxyLayer(kit, scene, { place, rulers, distanceText });
    const cosmos = createCosmosLayer(kit, scene, { place, rulers, labels, distanceText });
    const hud = createHud(store, camera, viewport);

    const { view } = store.getState();
    rig.snapToView(view);
    /* Arrived from the Orrery: open where it left off, then settle on this view. */
    const crossing = takeHandoff("deep-field", rig.limits());
    if (crossing?.pose) {
      rig.snap(crossing.pose);
      rig.flyToView(view);
    }
    rig.home();
    rig.applyPose();
    /* Leaving for the Orrery while the orbit is still in the ecliptic: it opens at this pose. */
    scope.defer(() => {
      if (galaxyMix(pose.distance) === 0) carryPose("deep-field", pose);
    });

    /* The guided journey flies its own shots; a drag or a zoom takes the camera back. */
    const guide = createGuide(rig, store, reduceMotion);
    const controls = createOrbitControls(scope, canvas, rig, {
      invalidate: () => engine.invalidate(),
      /* The rig clamps to its own limits, the ladder's ends. */
      distance: { min: LADDER_LY.near * LY * 0.5, max: LADDER_LY.far * LY * 1.1 },
      onInput: () => guide.takeOver(),
    });
    const continuous = () =>
      rig.moving || guide.busy || controls.interacting || lod.busy || solarKit.lod.busy;

    const labelPicks = new Map<string, Selection>([["galaxySun", { kind: "galaxy", id: "sun" }]]);
    const labelPick = (key: string): Selection | undefined =>
      solarLabelPick(key) ??
      reach.labelPick(key) ??
      labelPicks.get(key) ??
      neighbours.labelPick(key) ??
      cosmos.labelPick(key);
    createPicking(kit, canvas, store, {
      pickables: [
        ...solar.pickables,
        ...reach.pickables,
        ...neighbours.pickables,
        ...galaxy.pickables,
        ...cosmos.pickables,
      ],
      distance: () => pose.distance,
      labels: () => hits((key) => labelPick(key) !== undefined),
      labelPick,
    });

    /** What the bridge last acted on besides the view, flight and turn. */
    let lastSeek = store.getState().seek;
    const bridge = bridgeStore(store, scope, {
      invalidate: () => engine.invalidate(),
      before: (s) => {
        if (s.seek !== lastSeek) {
          lastSeek = s.seek;
          if (s.seek) rig.zoomTo(worldDistance(s.seek.ly), true);
        }
      },
      turn: (turn) => rig.turnBy(turn),
      fly: (s) => {
        /* The journey flies its own shots. */
        if (s.guideOpen) return;
        rig.flyToView(s.view);
        controls.cancel();
      },
    });
    bridgeAntialias(store, scope, sceneHost);
    const onMotionChange = () => engine.invalidate();
    reduceMotion.addEventListener("change", onMotionChange);
    scope.defer(() => reduceMotion.removeEventListener("change", onMotionChange));

    /**
     * The Galaxy and the cosmic map first, in a depth range fitted to them (their stars and
     * galaxies sit light-years behind the Sun's neighbours), then the neighbourhood over them.
     */
    const draw = () => {
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
      renderer.autoClear = true;
    };

    /**
     * The scale that dominated the last frame; a selection from another one is let go. Null
     * at first, so a selection the store kept from an earlier visit is checked on arrival.
     */
    let lastRealm: Realm | null = null;
    const tick = (dt: number, invalidated: boolean) =>
      bridge.frame(() => {
        const state = store.getState();
        guide.step(dt);
        rig.step(dt);
        rig.home();
        rig.applyPose();
        const dist = pose.distance;
        lod.begin(dt, dist);
        solarKit.lod.begin(dt, dist, rig.target);
        const realm = lod.realm;
        /* Zooming across a scale lets go of a selection from another one, unless a view
           flight is carrying the camera to that scale. The journey picks its own. */
        if (realm !== lastRealm && !state.guideOpen) {
          lastRealm = realm;
          const sel = state.selection;
          const flyingTo = rig.flying ? viewById(state.view).realm : null;
          if (sel && dropsSelection(sel, realm, flyingTo)) store.getState().select(null);
        }

        const frame: Frame = { show: state.show, sel: store.getState().selection, dist };
        const solarFrame: SolarFrame = {
          ...TODAY,
          dt,
          now: new Date(),
          show: { ...SOLAR_SHOW, names: state.show.names },
          sel: frame.sel && isSolarSelection(frame.sel) ? frame.sel : null,
          playing: false,
          dist,
        };
        sky.update(frame);
        const at = solar.update(solarFrame);
        reach.update(frame);
        /* The neighbours fade themselves out past the nearest stars. */
        neighbours.update(frame, pose.azimuth);
        if (state.show.distances && realm === "solar")
          rulers.drawFrom(
            frame.sel?.kind === "reach" && frame.sel.id !== "heliopause"
              ? frame.sel.id
              : rulerOrigin(solarFrame.sel, at),
            dist,
          );
        else if (state.show.distances && realm === "stars")
          rulers.drawFrom(frame.sel?.kind === "star" ? frame.sel.id : null, dist);
        galaxy.update(frame);
        cosmos.update(frame);
        rulers.finish();
        flush();

        hud.update(dt, invalidated || engine.dirty, {
          ly: dist / LY,
          aimLy: rig.aim.length() / LY,
          syncView: !rig.flying && !state.guideOpen,
          angles: pose,
        });
        sceneHost.render(draw);
        if (bridge.ready()) warmUp(scene);
      });

    engine.start({
      render: tick,
      paused: () => !(engine.dirty || continuous()),
      fps: () => (tight ? 48 : Infinity),
    });
    engine.refresh();
    return { dispose: () => scope.dispose() };
  } catch (error) {
    scope.dispose();
    throw error;
  }
}
