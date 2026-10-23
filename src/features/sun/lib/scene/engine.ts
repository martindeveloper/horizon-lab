/**
 * The Sun lab's renderer on the toolkit's scene host: the globe (the photosphere and the cut's
 * faces, ray-traced), the field's ribbons, the prominences' volume and the atmosphere, drawn
 * from a frame the model hands over and the settings the store keeps. The camera
 * (`camera-rig.ts`), the names (`names.ts`), the taps (`picking.ts`) and the wedge's motion
 * (`cut-motion.ts`) are its parts; it only interpolates and never advances the model itself.
 */
import { Group, Scene } from "three";

import { anglesOf, invalidateOnMotionChange } from "@/lib/scene-bridge";
import type { OrbitTurn } from "@horizon/toolkit/camera";
import { REDUCED_MOTION_QUERY } from "@horizon/toolkit/environment";
import { setDrawingBufferGamut, withScope } from "@horizon/toolkit/rendering";
import {
  DEFAULT_INSETS,
  SPACE_BLACK,
  createLabels,
  type PlaceLabel,
  createReadoutClock,
  createSceneHost,
  defaultSceneAntialias,
  worldPerPixel,
  type LabelInsets,
  type SceneAntialias,
  type SceneMount,
} from "@horizon/toolkit/scene";
import type { Gamut } from "@horizon/toolkit/science";

import { createLightTables } from "../graphics/light-tables";
import { lightDraws } from "../model/drawn";
import {
  BLOOM,
  COROTATE_ABOVE_RATE,
  DISSOLVE_S,
  ERUPTION_PLAY_S,
  RIBBON_HALO_PX,
  RIBBON_PRESENCE,
} from "../parameters";
import { sunQuality, type SunQuality } from "../quality";
import { createAtmosphereLayer } from "./atmosphere-layer";
import { createSunCamera } from "./camera-rig";
import { createCutMotion } from "./cut-motion";
import { createDissolve } from "./dissolve";
import { createFieldLayer } from "./field-layer";
import type { SunFrame } from "./frame";
import { createGlobeLayer } from "./globe-layer";
import { createSunLooks, lightKind, type LightKind } from "./looks";
import { FLARE_NAMED_LIGHT, createPlaceNames } from "./names";
import { createParkerLayer } from "./parker-layer";
import { createSunPicking } from "./picking";
import { createProminenceLayer } from "./prominence-layer";
import type { SunLight, SunSceneSettings, SunViewId } from "./settings";
import { createSkyLayer } from "./sky-layer";
import { createSunMap } from "./sun-map";
import type { SunEngine, SunEngineHooks, SunReadouts } from "./types";

/**
 * Keep the Milky Way visible but subordinate to the Sun, with more sky during totality.
 * This is an illustrative backdrop, not a camera exposure of the Sun and stars together.
 */
const SKY_EXPOSURE: Readonly<Record<LightKind, number>> = {
  white: 0.4,
  halpha: 0.3,
  band: 0.3,
  eclipse: 0.5,
  magnetogram: 0.3,
};

export function createSunEngine(
  { canvas, host, labelRoot, labels, onError }: SceneMount,
  settings: () => SunSceneSettings,
  frame: () => SunFrame,
  hooks: SunEngineHooks,
): SunEngine {
  const api = {
    flyToView: (_: SunViewId) => {},
    snapToView: (_: SunViewId) => {},
    turn: (_: OrbitTurn) => {},
    camera: { mark: () => () => {}, zoom: (_: number) => {}, turn: (_: OrbitTurn) => {} },
    invalidate: () => {},
    driftFlying: () => false,
    driftShot: () => -1,
  };
  const engine = withScope((scope) => {
    const sceneHost = createSceneHost(scope, {
      canvas,
      host,
      onError,
      clearColor: SPACE_BLACK,
    });
    const { renderer, camera, viewport, engine: loop, tight, basics, warmUp } = sceneHost;
    const scene = new Scene();
    /** The Sun's body frame: turned by the frame's `surfaceTurn`, so the lines, prominences, targets and names turn with the surface. */
    const body = new Group();
    scene.add(body);
    const reduceMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    invalidateOnMotionChange(scope, loop, reduceMotion);
    let current = settings();
    let quality: SunQuality = sunQuality(current.quality, tight);
    sceneHost.setResolution(quality.resolution);

    /* ------------------------------------------------------------ layers */
    const looks = createSunLooks();
    /* Parker Solar Probe on its orbit, and at its true size after the scene. */
    const parker = createParkerLayer(basics, scene, {
      gamut: looks.uniforms.uGamut.value,
      invalidate: () => loop.invalidate(),
      /* The labels are made with the camera's machinery below; the layer names only while drawing. */
      place: (...args: Parameters<PlaceLabel>) => place(...args),
    });
    const tables = createLightTables(scope, hooks.interior);
    const globe = createGlobeLayer(scope, scene, looks, tables);
    const field = createFieldLayer(scope, body, looks, tables);
    const prominences = createProminenceLayer(scope, body, {
      tight,
      invalidate: () => loop.invalidate(),
      onError,
    });
    const atmosphere = createAtmosphereLayer(scope, scene, looks, tables);
    const sky = createSkyLayer(scope, scene, basics.dpr, quality.sky, () => loop.invalidate());
    const sunMap = createSunMap(scope, {
      tier: () => quality.mapTier,
      onLoad: (texture, _width, finest) => {
        renderer.initTexture(texture);
        globe.setMap(texture);
        hooks.onMap?.(finest);
      },
      onStencil: (atlas, pages) => {
        renderer.initTexture(atlas);
        renderer.initTexture(pages);
        globe.setStencil(atlas, pages);
      },
      wake: () => loop.invalidate(),
    });
    const applyQuality = () => {
      globe.setQuality(quality);
      field.setQuality(quality);
      prominences.setQuality(quality);
      atmosphere.setQuality(quality);
      sky.setCounts(quality.sky);
      sceneHost.setResolution(quality.resolution);
      sceneHost.setBloom({ enabled: current.bloom, ...quality.bloom, ...BLOOM });
      sceneHost.setLens({ enabled: current.lens, ...quality.lens });
    };
    applyQuality();
    /** The light's exposure and how much a prominence shows in it, from the model's response curve. */
    const relight = (light: SunLight) => {
      const { scale, prominence } = tables.setResponse(light);
      looks.setLight(light, scale);
      prominences.setLight(light, prominence);
      tables.setRamp(light.ramp);
    };
    relight(current.light);
    field.setPresence(RIBBON_PRESENCE[lightKind(current.light.id)]);
    /** Another light is asked for: it is applied once the frame in the old one is kept to dissolve from. */
    let relightPending = false;
    const dissolve = createDissolve(scope, renderer, DISSOLVE_S);

    /* ------------------------------------------------------------ camera */
    /** The frame last drawn, what a tap, a zoom or a flight acts on; the first read afresh. */
    let drawn = frame();
    const cam = createSunCamera(scope, {
      camera,
      canvas,
      host,
      viewport,
      reduceMotion,
      invalidate: () => loop.invalidate(),
      parker,
      settings: () => current,
      drawn: () => drawn,
      onInput: hooks.onInput,
      drift: hooks.drift,
    });

    /* ----------------------------------------------------- names and taps */
    const insets: LabelInsets = { ...DEFAULT_INSETS };
    const { place, flush, hits } = createLabels(basics, labelRoot, labels, { insets });
    const names = createPlaceNames(place);
    /** The wedge as the shader sees it: half-angle and bisector, eased as the setting and the camera move. */
    const cut = looks.uniforms.uCut.value;
    const cutMotion = createCutMotion(cut, current.cut, camera.position, reduceMotion);
    const picking = createSunPicking(basics, canvas, {
      globe: globe.mesh,
      body,
      cut,
      drawn: () => drawn,
      blocked: () => cam.driftFlying(),
      hits,
      /* What a tap may open: a place the light draws; a flare once it shines. */
      draws: (place) =>
        lightDraws(place, light.id) &&
        (place !== "flare" || (drawn.eruption?.flareLight ?? 0) > FLARE_NAMED_LIGHT),
      onPick: (pick) => hooks.onPick?.(pick),
    });

    /* ----------------------------------------------------------- settings */
    let gamut: Gamut = "srgb";
    let antialias: SceneAntialias | null = null;
    let bloom: boolean | null = null;
    let lens: boolean | null = null;
    let light = current.light;
    let view = current.view;
    let level = current.quality;
    let closeUp = false;
    let ride = false;
    /** A view flight is under way; `landed` fires once it arrives. */
    let arriving = false;
    const applySettings = (s: SunSceneSettings) => {
      current = s;
      if (s.quality !== level) {
        level = s.quality;
        quality = sunQuality(level, tight);
        applyQuality();
      }
      const mode = s.antialias ?? defaultSceneAntialias(tight);
      if (mode !== antialias) {
        antialias = mode;
        sceneHost.setAntialias(mode);
      }
      if (s.bloom !== bloom) {
        bloom = s.bloom;
        sceneHost.setBloom({ enabled: bloom, ...quality.bloom, ...BLOOM });
      }
      if (s.lens !== lens) {
        lens = s.lens;
        sceneHost.setLens({ enabled: lens, ...quality.lens });
      }
      const wanted: Gamut = s.wideColour ? "p3" : "srgb";
      if (wanted !== gamut) {
        gamut = setDrawingBufferGamut(renderer, wanted);
        looks.setGamut(gamut);
      }
      if (s.light !== light) {
        light = s.light;
        relightPending = true;
      }
      if (s.closeUp !== closeUp) {
        closeUp = s.closeUp;
        ride = s.ride;
        cam.closeUpChanged(closeUp, ride, view, s.view === view);
      } else if (closeUp && s.ride !== ride) {
        ride = s.ride;
        cam.rideChanged(ride);
      }
      if (s.view !== view) {
        view = s.view;
        if (cam.viewChanged(view)) arriving = true;
      }
    };

    /* ---------------------------------------------------------- the frame */
    const readoutDue = createReadoutClock();
    let lastReadouts: SunReadouts | null = null;
    let lastSharpening = false;
    let ready = false;
    const clockRuns = () => {
      const clock = hooks.clock?.();
      return clock !== undefined && !clock.paused && clock.rate !== 0;
    };
    const continuous = () =>
      cam.moving ||
      cutMotion.moving ||
      dissolve.active ||
      globe.busy ||
      clockRuns() ||
      (hooks.eruption?.().playing ?? false);

    const tick = (dt: number, invalidated: boolean) => {
      applySettings(settings());
      /* The model's clock, then the eruption's scrub while it plays by itself. */
      if (clockRuns()) {
        const modelSeconds = hooks.clock!().rate * dt;
        hooks.advance?.(modelSeconds);
        if (hooks.clock!().rate > COROTATE_ABOVE_RATE) cam.corotate(modelSeconds);
      }
      const scrub = hooks.eruption?.();
      if (scrub?.playing && scrub.s < 1)
        hooks.onEruption?.(Math.min(1, scrub.s + dt / ERUPTION_PLAY_S));
      const f = frame();
      drawn = f;
      cam.step(f, dt);
      cutMotion.step(dt, current.cut);
      parker.update(dt, f, camera, { orbit: view === "orbit" && !closeUp, closeUp });

      /* A buffer pixel's world size per unit distance, and the ribbons' half-width in CSS px. */
      const cssPixel = worldPerPixel(camera.fov, 1, viewport.height);
      looks.uniforms.uPixelWorld.value = cssPixel / basics.dpr.value;
      field.setHalfWidth((RIBBON_HALO_PX / 2) * cssPixel);
      looks.setFrame(f);
      body.rotation.y = f.surfaceTurn;
      body.updateMatrixWorld();
      sunMap.update();
      /* The photosphere is the unit sphere: its nearest point is a radius in from the camera.
         Parker's model on its way counts as detail too. */
      const sharpening =
        sunMap.sharpening(looks.uniforms.uPixelWorld.value * (camera.position.length() - 1)) ||
        parker.waiting;
      if (sharpening !== lastSharpening) {
        lastSharpening = sharpening;
        hooks.onSharpening?.(sharpening);
      }
      const kind = lightKind(light.id);
      globe.step(dt);
      globe.update(current, camera);
      field.update(f, current.fieldLines);
      prominences.update(f, camera);
      atmosphere.update(f, current);
      sky.update(camera, SKY_EXPOSURE[kind]);
      names.update(f, {
        camera,
        viewport,
        shown: current.names && !cam.flying,
        cut,
        cutShown: cutMotion.shown,
        light: light.id,
        spicules: quality.spicules,
        fineSurface: quality.fineSurface,
        fieldLines: current.fieldLines,
        mapShown: globe.mapShown,
      });
      picking.update(f);
      flush();
      if (arriving && !cam.rig.flying) {
        arriving = false;
        hooks.landed?.();
      }

      /* Readouts, a few times a second, when they change; the clock and the flare's class with them. */
      const due = readoutDue(dt, invalidated);
      /* The flare's class once it shines; none while the eruption only stores and lifts. */
      const flaring = (f.eruption?.flareLight ?? 0) > FLARE_NAMED_LIGHT;
      if (due) hooks.publish?.(f.time, flaring ? f.eruption!.goesClass : "", f.cyclePhase);
      if (hooks.onReadout && due) {
        const readouts: SunReadouts = {
          ...anglesOf(cam.rig.pose),
          antialias: antialias ?? defaultSceneAntialias(tight),
        };
        const moved =
          !lastReadouts ||
          readouts.heading !== lastReadouts.heading ||
          readouts.tilt !== lastReadouts.tilt ||
          readouts.antialias !== lastReadouts.antialias;
        if (moved) {
          lastReadouts = readouts;
          hooks.onReadout(readouts);
        }
      }

      sceneHost.render(() => {
        renderer.render(scene, camera);
        parker.render(renderer);
      });
      /* The new light takes over from the frame just drawn in the old one, which fades over it. */
      if (relightPending) {
        relightPending = false;
        if (ready && !reduceMotion.matches) dissolve.capture();
        relight(light);
        field.setPresence(RIBBON_PRESENCE[lightKind(light.id)]);
        loop.invalidate();
      }
      dissolve.draw(dt);
      if (!ready) {
        ready = true;
        warmUp(scene);
        hooks.onReady?.();
      }
    };

    loop.start({
      render: (dt, invalidated) =>
        hooks.frame ? hooks.frame(() => tick(dt, invalidated)) : tick(dt, invalidated),
      paused: () => !(loop.dirty || continuous()),
      fps: () => quality.resolution.fps,
    });
    loop.refresh();

    api.flyToView = (id) => {
      cam.flyToView(id);
      arriving = true;
      loop.invalidate();
    };
    api.snapToView = (id) => cam.snapToView(id);
    api.turn = cam.turn;
    api.camera = cam.sceneCamera;
    api.invalidate = () => loop.invalidate();
    api.driftFlying = cam.driftFlying;
    api.driftShot = cam.driftShot;
  });
  return { ...api, dispose: engine.dispose };
}
