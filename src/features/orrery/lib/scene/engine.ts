/**
 * The orrery renderer. Plain three.js on the toolkit's engine host (viewport,
 * frame loop, context loss), orbit input and disposal scope. Frames are rendered only while
 * something moves (playback, along-orbit drift, a camera flight, a drag) or a
 * store change made the picture stale, so an idle orrery costs no GPU time.
 *
 * Each layer builds its objects once and draws one `Frame`; this file wires them
 * to the store, the camera and input.
 */
import {
  Group,
  NoToneMapping,
  PerspectiveCamera,
  SRGBColorSpace,
  Scene,
  WebGLRenderer,
  type Object3D,
  type Vector3,
} from "three";

import {
  MOON_IDS,
  NAMED,
  PLANET_IDS,
  keplerPosition,
  namedById,
  type BodyId,
} from "@horizon/toolkit/bodies";
import { createOrbitInput, stepOrbit } from "@horizon/toolkit/camera";
import {
  COARSE_POINTER_QUERY,
  REDUCED_MOTION_QUERY,
  prefersReducedMotion,
} from "@horizon/toolkit/environment";
import { clamp } from "@horizon/toolkit/math";
import { createEngineHost, DisposalScope } from "@horizon/toolkit/rendering";

import { createLooks } from "../graphics/looks";
import { namedElements, planetElements } from "../model/elements";
import { NEIGHBOURS } from "../model/neighbours";
import { solarActivityVisible } from "../model/solar-activity";
import { advancePlay, isPresentEra, migrationProgress, sunExists } from "../model/timeline";
import { DEFAULT_VIEW, driftYearsPerSecond, viewById, type ViewId } from "../model/views";
import { hasSurface, useOrrery, type OrreryStore } from "../store";
import { createCameraRig } from "./camera-rig";
import { createCloseUpController, type BodySelection } from "./close-up-controller";
import { createFocusRing } from "./focus-ring";
import { createGalaxyLayer } from "./galaxy-layer";
import { createGlobes } from "./geometry";
import { createGuideDirector } from "./guide-director";
import { createHud } from "./hud";
import {
  FOV,
  ORBIT_INCLINATION,
  createPxWorld,
  type Frame,
  type Labels,
  type SceneKit,
  type Viewport,
} from "./kit";
import { createLabels } from "./labels";
import { createMeasuredMaps } from "./measured-maps";
import { createMoonsLayer } from "./moons-layer";
import { createNeighboursLayer } from "./neighbours-layer";
import { createPicking } from "./picking";
import { createPlanetsLayer } from "./planets-layer";
import { createPopulationsLayer } from "./populations-layer";
import { createDistanceText, createRulers } from "./rulers";
import { createSkyLayer } from "./sky-layer";
import { createSolarActivityLifecycle } from "./solar-activity-lifecycle";
import { createSunLayer } from "./sun-layer";

export type OrreryEngine = { dispose: () => void };

/** Labels of the solar map, hidden while it is not drawn. */
const SOLAR_LABELS = [
  "sun",
  "snowLine",
  ...PLANET_IDS,
  ...NAMED.map((b) => b.id),
  ...MOON_IDS,
  "proximaRing",
  ...NEIGHBOURS.map((n) => n.id),
];

export function createOrreryEngine(
  canvas: HTMLCanvasElement,
  host: HTMLElement,
  labelRoot: HTMLElement,
  labels: Labels,
  onError: (error: unknown) => void,
): OrreryEngine {
  const scope = new DisposalScope();
  try {
    const coarse = window.matchMedia(COARSE_POINTER_QUERY).matches;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const tight = coarse || (memory != null && memory <= 4);
    const renderer = new WebGLRenderer({
      canvas,
      antialias: !tight,
      powerPreference: "low-power",
      alpha: false,
      stencil: false,
    });
    scope.defer(() => renderer.dispose());
    renderer.toneMapping = NoToneMapping;
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setClearColor(0x07080c, 1);

    const looks = scope.own(createLooks(tight));
    const scene = new Scene();
    const camera = new PerspectiveCamera(FOV, 1, 0.05, 2_000_000);
    const viewport: Viewport = { width: 1, height: 1 };
    const engine = scope.own(
      createEngineHost({
        canvas,
        host,
        resolution: () => ({
          scale: 1,
          dpr: window.devicePixelRatio || 1,
          dprCap: tight ? 1.25 : 1.5,
        }),
        onResize: (w, h) => {
          const rect = host.getBoundingClientRect();
          viewport.width = Math.max(1, rect.width);
          viewport.height = Math.max(1, rect.height);
          renderer.setSize(w, h, false);
          camera.aspect = viewport.width / viewport.height;
          camera.updateProjectionMatrix();
        },
        onError,
      }),
    );
    const kit: SceneKit = {
      scope,
      looks,
      camera,
      viewport,
      tight,
      dpr: Math.min(window.devicePixelRatio || 1, tight ? 1.25 : 1.5),
      pxWorld: createPxWorld(viewport),
    };

    const store = useOrrery;
    const reduceMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    const reducedMotion = prefersReducedMotion();
    let driftYears = 0;
    let interacting = false;
    let releaseTimer = 0;

    const rig = createCameraRig(camera, {
      state: () => store.getState(),
      reduceMotion,
      closeUp: () => closeUp.current,
    });
    const { pose } = rig;
    const { place, hideAll, setBodies, flush } = createLabels(kit, labelRoot, labels);
    const distanceText = createDistanceText(labels, () => store.getState().distanceUnit);
    const globes = createGlobes(kit);
    const hidesFor = (id: BodyId) => closeUp.hidesFor(id);

    const sky = createSkyLayer(kit, scene, store.getState().yearsAgo);
    const solar = new Group();
    scene.add(solar);
    const sun = createSunLayer(kit, solar, globes, place, hidesFor);
    const activity = scope.own(
      createSolarActivityLifecycle(
        async () => {
          const { createSolarActivity } = await import("./solar-activity");
          return () => createSolarActivity(kit, sun.sun);
        },
        () => engine.invalidate(),
        onError,
      ),
    );
    const guide = createGuideDirector(scope, solar, rig, {
      reducedMotion,
      holdBlocked: () => closeUp.current !== null || reduceMotion.matches,
    });
    const rulers = createRulers(kit, scene, place, distanceText);
    const moons = createMoonsLayer(kit, solar, globes, place);
    const planets = createPlanetsLayer(kit, solar, {
      globes,
      place,
      rulers,
      hosts: moons.hosts,
      hidesFor,
      closeId: () => closeUp.current?.id ?? null,
    });
    setBodies([
      { key: "sun", mesh: sun.sun },
      ...planets.planets.map(({ id, body }) => ({ key: id, mesh: body })),
      ...planets.named.map(({ body, mesh }) => ({ key: body.id, mesh })),
      ...moons.labelBodies,
    ]);
    const populations = createPopulationsLayer(kit, solar);
    const neighbours = createNeighboursLayer(kit, solar, { place, rulers, labels, distanceText });
    const focus = createFocusRing(kit, solar);
    const galaxy = createGalaxyLayer(kit, scene, { place, rulers, distanceText });
    const hud = createHud(store, viewport);

    /** Where the body is now: today's clock plus the Motion offset, as the scene draws it. */
    const located: [number, number, number] = [0, 0, 0];
    const locate = (sel: BodySelection, out: Vector3) => {
      if (sel.kind === "sun") return out.set(0, 0, 0);
      const mig = migrationProgress(store.getState().yearsAgo);
      const now = new Date();
      const el =
        sel.kind === "planet"
          ? planetElements(sel.id, mig, driftYears, now)
          : namedElements(namedById(sel.id), mig, driftYears, now);
      keplerPosition(el, located);
      return out.set(located[0], located[1], located[2]);
    };
    const bodyObjects = (sel: BodySelection): Object3D[] =>
      sel.kind === "sun"
        ? [sun.sun]
        : sel.kind === "planet"
          ? [planets.planets.find((p) => p.id === sel.id)!.body]
          : [planets.named.find((n) => n.body.id === sel.id)!.mesh];
    const closeUp = createCloseUpController(kit, {
      rig,
      reduceMotion,
      invalidate: () => engine.invalidate(),
      locate,
      objectsOf: (sel) => [
        ...bodyObjects(sel),
        ...moons.objectsOf(sel.kind === "sun" ? "sun" : sel.id),
      ],
      reachOf: (id) => moons.reachOf(id),
      onTakeCamera: () => {
        guide.cancelFlight();
        input.cancel();
      },
      onRelease: () => input.cancel(),
    });
    const maps = createMeasuredMaps(scope, (id, texture) => {
      looks.setMeasured(id, texture);
      closeUp.applyMeasured(id, texture);
      engine.invalidate();
    });

    const activityMoving = () => {
      const s = store.getState();
      return (
        solarActivityVisible(s, closeUp.current, rig.realm === "solar" && sunExists(s.yearsAgo)) &&
        !s.solarActivityPaused &&
        !reduceMotion.matches
      );
    };
    const continuous = () => {
      const s = store.getState();
      return (
        s.playing ||
        (s.show.drift && rig.realm === "solar" && !closeUp.current) ||
        rig.flying ||
        guide.busy(s) ||
        interacting ||
        sky.easing ||
        closeUp.busy() ||
        (activity.current !== null && activityMoving())
      );
    };

    rig.snapToView(store.getState().view);
    rig.applyPose();

    /* The store bridge: what it last acted on, so its own writes are not acted on twice. */
    let lastFlight = store.getState().flight;
    let lastView = store.getState().view;
    let lastTurn = store.getState().turn;
    let lastCloseUp = store.getState().closeUp;

    const crossAtEdge = (requested: number) => {
      const bounds = rig.limits();
      const inward = rig.realm === "galaxy";
      const edge = inward ? bounds.min : bounds.max;
      const push = inward ? Math.log(edge / requested) : Math.log(requested / edge);
      if (push <= 0) rig.edgePush = 0;
      const atEdge = Math.abs(Math.log(pose.distance / edge)) < 0.01;
      const s = store.getState();
      if (push <= 0 || !atEdge || s.guideOpen || (inward && rig.homing < 0.99)) return false;
      rig.edgePush += push;
      if (rig.edgePush < 0.45) return false;
      rig.edgePush = 0;
      const view: ViewId = inward ? DEFAULT_VIEW : "galaxy";
      /* Already flown here; the store bridge must not start the flight again. */
      lastView = view;
      store.setState({ view, selection: null });
      rig.flyToView(view);
      input.cancel();
      return true;
    };

    const input = scope.own(
      createOrbitInput(canvas, {
        getPose: () => pose,
        onChange: (next) => {
          const close = closeUp.current;
          if (close) {
            /* Flights own the camera; once arrived, a deliberate pull past the far limit leaves. */
            if (close.phase !== "on") return;
            const far = rig.limits().max;
            if (next.distance > far && pose.distance >= far * 0.99) {
              rig.edgePush += Math.log(next.distance / far);
              if (rig.edgePush > 0.45) {
                rig.edgePush = 0;
                store.getState().leaveCloseUp();
                return;
              }
            } else rig.edgePush = 0;
          } else if (crossAtEdge(next.distance)) return;
          const bounds = rig.limits();
          pose.azimuth = next.azimuth;
          pose.inclination = next.inclination;
          pose.distance = clamp(next.distance, bounds.min, bounds.max);
          rig.flying = false;
          guide.takeOver();
          interacting = true;
          window.clearTimeout(releaseTimer);
          releaseTimer = window.setTimeout(() => {
            interacting = false;
            engine.invalidate();
          }, 700);
          engine.invalidate();
        },
        /* The engine clamps to its own limits, which reach true-size close-ups. */
        distance: { min: 1e-12, max: 2_600_000 },
        inclination: ORBIT_INCLINATION,
        dragSensitivity: { azimuth: 0.0055, inclination: 0.0045 },
        wheelSensitivity: () => 0.0012,
      }),
    );
    scope.defer(() => window.clearTimeout(releaseTimer));

    createPicking(kit, canvas, store, {
      pickables: [
        sun.sun,
        ...planets.pickables,
        ...populations.pickables,
        ...neighbours.pickables,
        ...galaxy.pickables,
      ],
      blocked: () => store.getState().guideOpen || closeUp.current !== null,
      distance: () => pose.distance,
    });

    const unsubscribe = store.subscribe((s) => {
      activity.setEnabled(s.solarActivity);
      if (s.turn !== lastTurn) {
        lastTurn = s.turn;
        /* Button steps snap, so they read the same with reduced motion. */
        if (s.turn && !s.guideOpen) {
          Object.assign(pose, stepOrbit(pose, s.turn, { inclination: ORBIT_INCLINATION }));
          guide.cancelFlight();
        }
      }
      if (s.guideOpen && closeUp.current) closeUp.end(false);
      if (s.flight !== lastFlight || s.view !== lastView) {
        lastFlight = s.flight;
        lastView = s.view;
        const view = viewById(s.view);
        if (closeUp.current && view.realm === "solar" && !reduceMotion.matches) {
          /* Leaving a close-up for a view: one flight, out of the body and on to the view. */
          rig.flightTarget = view.dist;
          closeUp.leaveTo({
            azimuth: view.azimuth ?? pose.azimuth,
            inclination: view.inclination ?? 0.52,
            distance: view.dist,
          });
        } else {
          closeUp.end(false);
          /* The guide flies its own poses. */
          if (!s.guideOpen) rig.flyToView(s.view);
        }
        input.cancel();
      }
      if (s.closeUp !== lastCloseUp) {
        lastCloseUp = s.closeUp;
        if (s.closeUp && hasSurface(s.selection)) closeUp.start(s.selection);
        else if (!s.closeUp) closeUp.leave();
      }
      engine.invalidate();
    });
    scope.defer(unsubscribe);
    activity.setEnabled(store.getState().solarActivity);
    const onMotionChange = () => engine.invalidate();
    reduceMotion.addEventListener("change", onMotionChange);
    scope.defer(() => reduceMotion.removeEventListener("change", onMotionChange));
    if (reducedMotion) store.getState().patchShow({ drift: false });

    /* The store is written a few times a second; between commits the playback head lives here.
       A slider move while playing shows up as a store value we did not commit. */
    let playHead: number | null = null;
    let playCommitted = -1;
    let playClock = 0;
    const advanceClock = (state: OrreryStore, dt: number) => {
      if (!state.playing) {
        playHead = null;
        return state.yearsAgo;
      }
      if (playHead === null || state.yearsAgo !== playCommitted) playHead = state.yearsAgo;
      playHead = advancePlay(playHead, dt);
      playClock += dt;
      if (playHead <= 0 || playClock > 0.08) {
        store.getState().setYearsFromPlay(playHead);
        playCommitted = playHead;
        if (playHead <= 0) store.setState({ playing: false });
        playClock = 0;
      }
      return playHead;
    };

    const tick = (dt: number, invalidated: boolean) => {
      const state = store.getState();
      const show = state.show;
      const now = new Date();

      guide.stepCamera(state, dt);
      rig.stepFlight(dt);
      rig.home();
      closeUp.step(dt);
      rig.applyPose();
      const dist = pose.distance;

      const yearsAgo = advanceClock(state, dt);
      /* A close-up holds the clock: at true size the speed-up would whirl the Sun around. */
      if (show.drift && rig.realm === "solar" && !closeUp.current)
        driftYears += dt * driftYearsPerSecond(dist, "solar");

      const frame: Frame = {
        dt,
        now,
        show,
        sel: state.selection,
        yearsAgo,
        playing: state.playing,
        mig: migrationProgress(yearsAgo),
        driftYears,
        dist,
        present: isPresentEra(yearsAgo),
      };
      guide.stepSketch(state, frame);
      const solarRealm = rig.realm === "solar";
      const solarOn = solarRealm && sunExists(yearsAgo);
      solar.visible = solarOn;
      sky.update(frame, solarRealm);

      if (solarOn) {
        sun.update(frame);
        planets.update(frame);
        moons.update(frame);
        populations.update(frame);
        neighbours.update(frame, pose.azimuth);
        const at = focus.update(frame, closeUp.current !== null);
        if (show.distances) rulers.drawFrom(frame.sel, at, dist);
      } else hideAll(SOLAR_LABELS);
      // Off has no effect object, update callback, scene node or GPU resources.
      activity.current?.update(
        dt,
        solarActivityVisible(state, closeUp.current, solarOn),
        !state.solarActivityPaused && !reduceMotion.matches,
      );
      rulers.finish();
      galaxy.update(frame, rig.realm === "galaxy");
      flush();

      hud.update(dt, invalidated || engine.dirty, {
        dist,
        realm: rig.realm,
        drift: show.drift && !closeUp.current,
        driftYears,
      });
      closeUp.render(renderer, scene);
      if (!store.getState().ready) store.getState().setReady(true);
      maps.request();
    };

    engine.start({
      render: tick,
      paused: () => !(engine.dirty || continuous()),
      // Limit model-only playback, preserving responsive camera motion and flights.
      fps: () =>
        activity.current !== null &&
        activityMoving() &&
        !interacting &&
        !rig.flying &&
        !closeUp.busy()
          ? tight
            ? 24
            : 30
          : tight
            ? 48
            : Infinity,
    });
    engine.refresh();
    return { dispose: () => scope.dispose() };
  } catch (error) {
    scope.dispose();
    throw error;
  }
}
