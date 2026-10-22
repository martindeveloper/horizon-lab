/**
 * The orrery renderer, on the toolkit's scene host (renderer, camera, frame loop), orbit
 * rig and controls, with the store bridged by `bridgeStore`. Frames are rendered only while
 * something moves (playback, along-orbit drift, a camera flight, a drag) or a
 * store change made the picture stale, so an idle orrery costs no GPU time.
 *
 * Each layer builds its objects once and draws one `Frame`; this file wires them
 * to the store, the camera, input and the level of detail (lod.ts): one world in au, the
 * solar map, then a close-up body, then Earth's observatories at their true size.
 */
import { Scene, type Object3D, type Vector3 } from "three";

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
import { isPresentEra, momentAt, sunExists } from "@/space/solar-system/model/moment";
import { observatoryPosition } from "@/space/solar-system/model/observatories";
import { positionOf } from "@/space/solar-system/model/position";
import { solarViewById, solarViewPose } from "@/space/solar-system/model/views";
import { createSolarKit, type SolarFrame } from "@/space/solar-system/scene/kit";
import { createObservatoriesLayer } from "@/space/solar-system/scene/observatories-layer";
import {
  SOLAR_RULER_KEYS,
  createSolarSystem,
  rulerOrigin,
  solarLabelPick,
} from "@/space/solar-system/scene/solar-system";
import type { BodyId, Vec3 } from "@horizon/toolkit/bodies";
import { REDUCED_MOTION_QUERY, prefersReducedMotion } from "@horizon/toolkit/environment";
import { clamp01, smootherstep } from "@horizon/toolkit/math";
import { withScope, type SimulationEngine } from "@horizon/toolkit/rendering";
import {
  SOLAR_GOLD,
  createAnchoredRulers,
  createDistanceText,
  createLabels,
  createLineVeil,
  createOrbitControls,
  createSceneHost,
  type SceneMount,
  DEFAULT_INSETS,
} from "@horizon/toolkit/scene";

import { DRIFT } from "../drift";
import { EARTH, solarPart, upFrom } from "../model/selection";
import { solarActivityVisible } from "../model/solar-activity";
import { advancePlay } from "../model/timeline";
import { driftYearsPerSecond } from "../model/views";
import { orreryQuality } from "../quality";
import { useOrrery, type OrreryStore } from "../store";
import { createCameraRig } from "./camera-rig";
import { createCloseUpController, type BodySelection } from "./close-up-controller";
import { createDriftDirector } from "./drift-director";
import { createGuideDirector } from "./guide-director";
import { createHud } from "./hud";
import { ORRERY_EDGE, SOLAR_EDGE } from "./kit";
import { createMeasuredMaps } from "./measured-maps";
import { createPicking } from "./picking";
import { createSkyLayer } from "./sky-layer";
import { createSolarActivityLifecycle } from "./solar-activity-lifecycle";

/** Seconds the Motion toggle takes to ease the orbits to a stop or back up to speed. */
const MOTION_RAMP = 0.7;

export function createOrreryEngine({
  canvas,
  host,
  labelRoot,
  labels,
  locale,
  onError,
}: SceneMount): SimulationEngine {
  return withScope((scope) => {
    const sceneHost = createSceneHost(scope, { canvas, host, onError });
    const { renderer, camera, viewport, engine, tight, basics, warmUp } = sceneHost;
    /** The visitor's render quality as the Orrery's settings; `bridgeRender` keeps it current. */
    let quality = orreryQuality(useOrrery.getState().quality, tight);
    sceneHost.setResolution(quality.resolution);
    sceneHost.setBloom({ enabled: useOrrery.getState().bloom, ...quality.bloom });
    sceneHost.setLens({ enabled: useOrrery.getState().lens, ...quality.lens });
    /* Measured maps stream in by need (measured-maps.ts); bodies wait in their mean colour. */
    const kit = createSolarKit(basics, "streamed");
    const { looks, lod } = kit;
    looks.setAirSteps(quality.closeUp.airSteps);
    const scene = new Scene();

    const store = useOrrery;
    const reduceMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    const reducedMotion = prefersReducedMotion();
    let driftYears = 0;
    /** Ramp position of the Motion toggle, 0 (held) to 1 (full rate); eased so orbits glide to a stop and back. */
    let motionRamp = store.getState().show.drift ? 1 : 0;

    const rig = createCameraRig(camera, {
      reduceMotion,
      closeUp: () => closeUp.current,
    });
    const { pose } = rig;
    /* Names keep above the time dock where it publishes its height (phones), else 150 px. */
    const dockClear = stageClearance(host, "--hud-clear", 150);
    const { place, hideAll, setBodies, flush, hits } = createLabels(kit, labelRoot, labels, {
      insets: () => ({ ...DEFAULT_INSETS, bottom: dockClear() }),
    });
    const distanceText = createDistanceText(labels, () => store.getState().distanceUnit, locale);
    const shownFor = (id: BodyId) => closeUp.shownFor(id);
    /* One moment a frame for everything that moves on the clock: the close-up's aim and the
       scene alike, so a craft a few metres across sits exactly where the camera looks. */
    let now = new Date();

    const sky = createSkyLayer(kit, scene, store.getState().yearsAgo, quality.sky);
    /* Rulers from the selection (or the Sun) to every planet and named body on screen. */
    const rulers = createAnchoredRulers(scope, scene, place, {
      keys: SOLAR_RULER_KEYS,
      color: SOLAR_GOLD,
      pxWorld: kit.pxWorld,
      distanceText,
    });
    const solar = createSolarSystem(kit, scene, {
      place,
      hideAll,
      setBodies,
      rulers,
      shownFor,
      closeId: () => closeUp.current?.globe ?? null,
      swarms: quality.swarms,
    });
    const { planets, moons } = solar;
    /* Earth's observatories, with the solar system: in its depth passes about Earth, and at
       their true size after them. */
    const observatories = createObservatoriesLayer(kit, solar.root, {
      place,
      shownFor: (id) => closeUp.shownFor(id),
      invalidate: () => engine.invalidate(),
    });
    const labelPick = (key: string) => solarLabelPick(key) ?? observatories.labelPick(key);
    const activity = scope.own(
      createSolarActivityLifecycle(
        async () => {
          const { createSolarActivity, solarActivityDensity } = await import("./solar-activity");
          const density = await solarActivityDensity(kit.tight);
          return () => createSolarActivity(kit, solar.sun, quality.activitySteps, density);
        },
        () => engine.invalidate(),
        onError,
      ),
    );
    const guide = createGuideDirector(scope, solar.root, rig, {
      reduceMotion,
      holdBlocked: () => closeUp.current !== null,
    });
    /* The drift flies the framed shots itself and visits bodies through the close-up. */
    const drift = createDriftDirector(rig, store, {
      reduceMotion,
      closeUp: () => closeUp.current,
      moonPose: (base) => closeUp.moonPose(base),
      release: (landing) => closeUp.release(landing),
      reclaim: () => closeUp.reclaim(),
      finish: () => closeUp.end(false),
    });
    /* The drift veils the line art: orbits, the grid and rulers fade, the bodies and sky stay. */
    const veil = createLineVeil();
    const hud = createHud(store, camera, viewport);

    /** Where the body is now: today's clock plus the Motion offset, as the scene draws it. */
    const located: Vec3 = [0, 0, 0];
    const locate = (sel: BodySelection, out: Vector3) => {
      const moment = momentAt(store.getState().yearsAgo, driftYears);
      /* An observatory beyond the Earth the scene draws, as the observatories layer places it;
         a moon where its system draws it (magnified about its planet until the camera is near). */
      const at =
        sel.kind === "observatory"
          ? observatoryPosition(sel.id, moment, now, located)
          : ((sel.kind === "moon" ? moons.drawnAt(sel.id) : null) ??
            positionOf(sel, moment, now, located) ??
            located);
      return out.set(at[0], at[1], at[2]);
    };
    /** Earth's observatories join Earth wherever it has a depth pass of its own. */
    const withEarth = (id: BodyId, objects: Object3D[]) =>
      id === EARTH.id ? [...objects, ...observatories.objects] : objects;
    const bodyObjects = (sel: Exclude<BodySelection, { kind: "observatory" }>): Object3D[] => {
      switch (sel.kind) {
        case "sun":
          return [solar.sun];
        case "planet":
          return [planets.planets.find((p) => p.id === sel.id)!.body];
        case "named":
          return [planets.named.find((n) => n.body.id === sel.id)!.mesh];
        case "moon":
          return [moons.meshOf(sel.id)];
      }
    };
    const closeUp = createCloseUpController(kit, {
      rig,
      reduceMotion,
      invalidate: () => engine.invalidate(),
      locate,
      /* A craft is drawn by the observatories' own pass; Earth below it is its host. */
      objectsOf: (sel) => {
        if (sel.kind === "observatory") return [];
        const id = sel.kind === "sun" ? "sun" : sel.id;
        return withEarth(id, [...bodyObjects(sel), ...moons.objectsOf(id)]);
      },
      hostOf: (sel) => {
        const host = upFrom(sel);
        return host ? withEarth(host.id, bodyObjects(host)) : [];
      },
      hostReach: (sel) => (upFrom(sel)?.id === EARTH.id ? observatories.reach : 0),
      reachOf: (id) => Math.max(moons.reachOf(id), id === EARTH.id ? observatories.reach : 0),
      onTakeCamera: () => {
        guide.cancelFlight();
        controls.cancel();
      },
      onRelease: () => controls.cancel(),
      upload: (texture) => renderer.initTexture(texture),
      quality: () => quality.closeUp,
      /* The drift's visits are its own (`visitStyle`); the card shows only outside it. */
      style: () => (store.getState().drift === "off" ? TAP_STYLE : drift.visitStyle()),
      paused: () => store.getState().drift === "paused",
      card: () => store.getState().drift === "off",
    });
    /** A body's new map is still fading in over its placeholder: keep frames coming. */
    let surfacesFading = false;
    const maps = createMeasuredMaps(scope, {
      quality: () => quality.maps,
      onLoad: (id, texture) => {
        renderer.initTexture(texture);
        looks.setMeasured(id, texture);
        engine.invalidate();
      },
      onFail: (id) => {
        looks.setFailed(id);
        engine.invalidate();
      },
      onRelease: (id) => {
        looks.clearMeasured(id);
        engine.invalidate();
      },
      wake: () => engine.invalidate(),
    });

    const activityMoving = () => {
      const s = store.getState();
      return (
        solarActivityVisible(s, closeUp.current, sunExists(s.yearsAgo)) &&
        !s.solarActivityPaused &&
        !reduceMotion.matches
      );
    };
    const continuous = () => {
      const s = store.getState();
      return (
        s.playing ||
        (s.show.drift && !closeUp.current) ||
        motionRamp !== (s.show.drift ? 1 : 0) ||
        rig.moving ||
        guide.busy() ||
        drift.busy ||
        veil.busy ||
        controls.interacting ||
        sky.easing ||
        lod.busy ||
        closeUp.busy() ||
        surfacesFading ||
        (activity.current !== null && activityMoving())
      );
    };

    const { view } = store.getState();
    rig.snapToView(view);
    /* Arrived from Deep Field: open where it left off, or, from past the Oort cloud, come in
       from the Orrery's edge; then settle on this view. Leaving for Deep Field: it opens at
       this pose, or from a close-up, at the pose the close-up flew in from. */
    bridgeHandoff(scope, "orrery", rig, view, {
      arriveAt: (crossing) => crossing.pose ?? { distance: ORRERY_EDGE },
      leaveAt: () => closeUp.current?.home ?? pose,
    });
    rig.applyPose();

    const controls = createOrbitControls(scope, canvas, rig, {
      invalidate: () => engine.invalidate(),
      /* The rig clamps to its own limits, from true-size close-ups to past the Oort cloud. */
      distance: { min: 1e-12, max: SOLAR_EDGE },
      intercept: (next) => {
        const close = closeUp.current;
        if (!close) return false;
        /* Flights own the camera; once arrived, a deliberate pull past the far limit leaves. */
        if (close.phase !== "on") return true;
        const far = rig.limits().max;
        if (next.distance > far && rig.target >= far * 0.99) {
          rig.edgePush += Math.log(next.distance / far);
          if (rig.edgePush > 0.45) {
            rig.edgePush = 0;
            store.getState().leaveCloseUp(true);
            return true;
          }
        } else rig.edgePush = 0;
        return false;
      },
      onInput: () => {
        guide.takeOver();
        drift.takeOver();
      },
    });

    /* Names open what they name; the snow line and rulers have nothing to open. */
    createPicking(kit, canvas, store, {
      pickables: [...solar.pickables, ...observatories.pickables],
      blocked: () => {
        const s = store.getState();
        const flying = closeUp.current !== null && closeUp.current.phase !== "on";
        return s.guideOpen || s.drift !== "off" || flying;
      },
      distance: () => pose.distance,
      labels: () => hits((key) => labelPick(key) !== undefined),
      labelPick,
    });

    /* What the bridge last acted on besides the view, flight and turn. */
    let lastCloseUp = store.getState().closeUp;
    let lastSelection = store.getState().selection;
    const bridge = bridgeStore(store, scope, {
      invalidate: () => engine.invalidate(),
      before: (s) => {
        activity.setEnabled(s.solarActivity);
        /* The guide takes the camera; a turn is ignored while it does. */
        if (s.guideOpen && closeUp.current) closeUp.end(false);
      },
      turn: (turn, s) => {
        if (s.guideOpen) return;
        rig.turnBy(turn);
        guide.cancelFlight();
      },
      fly: (s) => {
        const view = solarViewById(s.view);
        if (closeUp.current && !reduceMotion.matches) {
          /* Leaving a close-up for a view: one flight, out of the body and on to the view. */
          closeUp.leaveTo({ ...solarViewPose(view), azimuth: view.azimuth ?? pose.azimuth });
        } else {
          closeUp.end(false);
          /* The guide and the drift fly their own poses. */
          if (!s.guideOpen && s.drift === "off") rig.flyToView(s.view);
        }
        controls.cancel();
      },
      after: (s) => {
        if (s.selection !== lastSelection) {
          lastSelection = s.selection;
          if (isPresentEra(s.yearsAgo) && !s.guideOpen) closeUp.prefetch(s.selection);
        }
        /* From one close-up to another (the Earth's to the Moon's) is one flight. A close-up
           a drift's start clears ends at once behind the drift's curtain, which the camera's
           cut to the opening shot follows. */
        if (s.closeUp !== lastCloseUp) {
          lastCloseUp = s.closeUp;
          if (s.closeUp) closeUp.start(s.closeUp);
          else if (s.drift === "loading") closeUp.end(true);
          else closeUp.leave();
        }
      },
    });
    activity.setEnabled(store.getState().solarActivity);
    /* The camera as the store borrows it. The way back flies home within the close-up it was
       marked in, or out of one entered since; a close-up the store gives back lands on its own. */
    const orbit = orbitCamera(rig, () => engine.invalidate());
    scope.defer(
      lendCamera(store, {
        ...orbit,
        mark: () => {
          const marked = closeUp.current;
          const home = rig.inputPose();
          const back = orbit.mark();
          return () => {
            const now = closeUp.current;
            if (now === marked) back();
            else if (!marked && now?.phase === "out") {
              closeUp.leaveTo(home);
              engine.invalidate();
            }
          };
        },
      }),
    );
    bridgeRender(store, scope, sceneHost, (level) => {
      quality = orreryQuality(level, tight);
      sceneHost.setResolution(quality.resolution);
      sceneHost.setBloom({ enabled: store.getState().bloom, ...quality.bloom });
      sceneHost.setLens({ enabled: store.getState().lens, ...quality.lens });
      sky.setCounts(quality.sky);
      solar.setSwarms(quality.swarms);
      activity.current?.setSteps(quality.activitySteps);
      maps.refilter();
      closeUp.refilter();
      looks.setAirSteps(quality.closeUp.airSteps);
      engine.invalidate();
    });
    invalidateOnMotionChange(scope, engine, reduceMotion);
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

    /** The solar map, then a close-up body over it, then the observatories near enough to see. */
    const draw = () => {
      veil.cover(scene);
      renderer.render(scene, camera);
      closeUp.renderBody(renderer, scene);
      observatories.render(renderer);
      veil.uncover();
    };
    /* The camera as the rig holds it: its aim and its exact offset from there. */
    const aimAt: Vec3 = [0, 0, 0];
    const cameraOffset: Vec3 = [0, 0, 0];

    const tick = (dt: number, invalidated: boolean) =>
      bridge.frame(() => {
        const state = store.getState();
        const show = state.show;
        now = new Date();

        /* The clock first, so the camera steps on where the bodies are this frame: a close-up
           tracking a moving body would otherwise trail it by a frame. A close-up holds the clock:
           at true size the speed-up would whirl the Sun around (a drift's visit eases it out on
           the way in and back in on the way out, so the system never freezes mid-glide). The
           drift holds the rate down, so the inner planets glide through its wide framings. */
        const yearsAgo = advanceClock(state, dt);
        const step = reduceMotion.matches ? 1 : dt / MOTION_RAMP;
        motionRamp = clamp01(motionRamp + (show.drift ? step : -step));
        const driftRate =
          motionRamp > 0
            ? Math.min(
                driftYearsPerSecond(pose.distance),
                state.drift === "off" ? Infinity : DRIFT.clock,
              ) * closeUp.clockShare()
            : 0;
        driftYears += dt * driftRate * smootherstep(motionRamp);

        guide.stepCamera(state, dt);
        drift.step(dt);
        veil.step(dt, state.drift === "off");
        rig.step(dt);
        rig.home();
        closeUp.step(dt);
        surfacesFading = looks.step(dt);
        rig.applyPose();
        const dist = pose.distance;
        lod.begin(dt, dist, rig.target);

        const selection = store.getState().selection;
        const frame: SolarFrame = {
          ...momentAt(yearsAgo, driftYears),
          dt,
          now,
          show,
          sel: solarPart(selection),
          playing: state.playing,
          dist,
        };
        guide.stepSketch(state, frame);
        sky.update(frame);
        const at = solar.update(frame, closeUp.current !== null);
        const craft = closeUp.current?.sel;
        observatories.update({
          dt,
          now,
          present: frame.present,
          names: show.names,
          sel: selection,
          hosts: moons.hosts,
          magnified: moons.magnifiedOf(EARTH.id),
          base: rig.aim.toArray(aimAt),
          offset: rig.offset.toArray(cameraOffset),
          approach: craft?.kind === "observatory" ? craft.id : null,
        });
        if (observatories.waiting !== state.sharpening)
          store.setState({ sharpening: observatories.waiting });
        const solarOn = sunExists(yearsAgo);
        /* Rulers carry their readouts: the drift leaves them out with the rest of the line art. */
        if (show.distances && solarOn && state.drift === "off")
          rulers.drawFrom(rulerOrigin(frame.sel, at), dist);
        // Off has no effect object, update callback, scene node or GPU resources.
        activity.current?.update(
          dt,
          solarActivityVisible(state, closeUp.current, solarOn),
          !state.solarActivityPaused && !reduceMotion.matches,
        );
        rulers.finish();
        flush();

        hud.update(dt, invalidated || engine.dirty, {
          dist,
          driftRate: show.drift ? driftRate : 0,
          driftYears,
          syncView: !rig.flying && !closeUp.current && !state.guideOpen,
          angles: pose,
        });
        sceneHost.render(draw);
        if (bridge.ready()) {
          maps.start();
          warmUp(scene);
        }
        maps.update(dt, lod.need, closeUp.current?.globe ?? null);
      });

    engine.start({
      render: tick,
      paused: () => !(engine.dirty || continuous()),
      // Limit model-only playback, preserving responsive camera motion and flights.
      fps: () =>
        Math.min(
          quality.resolution.fps,
          activity.current !== null &&
            activityMoving() &&
            !controls.interacting &&
            !rig.moving &&
            !closeUp.busy()
            ? tight
              ? 24
              : 30
            : Infinity,
        ),
    });
    engine.refresh();
  });
}
