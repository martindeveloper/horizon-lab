/**
 * Giants' engine: the ladder drawn by one shader pass, the camera's place on it and the hands
 * that move it. A wheel or a drag glides the camera; when the hand lets go it settles on the
 * nearest rung, so stopping always lands on a body. A tap on a body opens its card. The store's
 * flights (a link, the stars panel, the guide) move it too. Each frame the engine places the
 * bodies (`ladder.ts`), fills the shader's discs, moves the names over them and tells the
 * store where the camera is.
 */
import { Vector2, Vector3, Vector4, type Texture } from "three";

import { assetUrl, MAPS_KEY } from "@/lib/assets";
import { MAPS, jplElements, mapFile } from "@horizon/toolkit/bodies";
import { TAP_SLOP_PX, wheelPixels } from "@horizon/toolkit/camera";
import { prefersReducedMotion } from "@horizon/toolkit/environment";
import { smoothstep } from "@horizon/toolkit/math";
import {
  DisposalScope,
  createEngineHost,
  createFullscreenPass,
  type SimulationEngine,
} from "@horizon/toolkit/rendering";
import { loadMap } from "@horizon/toolkit/scene";
import { convert, decodeSrgb, hexToLinear } from "@horizon/toolkit/science";
import { fullscreenVertex } from "@horizon/toolkit/shaders";
import { isSceneShortcut } from "@horizon/toolkit/ui";

import focusBlurShader from "./graphics/focus-blur.frag.glsl";
import fragmentShader from "./graphics/giants.frag.glsl";
import { stellarTables } from "./graphics/stellar-tables";
import { discTints } from "./graphics/tints";
import { vectors } from "./graphics/vectors";
import { weatherUniforms } from "./graphics/weather-uniforms";
import { createForecast, turnAt } from "./model/activity";
import { radiusMetres } from "./model/catalogue";
import { fadeFocusBlur, focusBlurRadius } from "./model/focus-blur";
import { glideAt, glideFrom, glideRests, glideSeconds, glideTowards } from "./model/glide";
import { letGo, poseRests, restPose, settlePose, turnBy } from "./model/grab";
import { NOBODY, handOver, handOverAtOnce, type HandOver } from "./model/hand-over";
import { inspectCamera } from "./model/inspection";
import {
  blankPlaced,
  bodyAt,
  cameraAt,
  clampRung,
  createLadder,
  horizonOf,
  nearestRung,
  placeBodiesInto,
  placeBody,
  type Camera,
  type Placed,
  type Stage,
} from "./model/ladder";
import { LOOKS } from "./model/looks";
import { ringRadius, ringShown } from "./model/orbit-rings";
import { RUNG_IDS } from "./model/rungs";
import { surfaceDetail } from "./model/surface-detail";
import { NO_WEATHER, fadeWeather, weatherShown } from "./model/weather-fade";
import {
  ACCENT_SRGB,
  BALMER_SRGB,
  BROWN_DWARF_ALKALI,
  DRAG_RUNGS,
  GRAB_MIN_PX,
  IDLE_FPS,
  MAX_DISCS,
  MIN_DISC_PX,
  ORBIT_FADE_IN_S,
  ORBIT_FADE_OUT_S,
  ORBIT_IDS,
  ORBIT_LABEL_GAP_PX,
  ORBIT_LABEL_MIN_PX,
  SHADER_DEFINES,
  SNAP_DELAY_MS,
  SPACE_SRGB,
  STYLES,
  LENSES,
  LENS_FULL,
  LENS_GONE,
  WEATHER_NEAR,
  WHEEL_RUNGS,
} from "./parameters";
import { GIANTS_QUALITY, bloomSettings } from "./quality";
import { useGiants } from "./store";

/** An encoded sRGB colour (0–1 a channel, or a hex string) as linear light for the shader. */
const linearRgb = (colour: readonly [number, number, number] | string) => {
  const [r, g, b] = typeof colour === "string" ? hexToLinear(colour) : colour.map(decodeSrgb);
  return new Vector3(r, g, b);
};

/**
 * A spheroid's silhouette height over its equatorial radius when its pole is tipped `tilt`
 * towards us: √(k² cos² tilt + sin² tilt), k its polar over equatorial radius.
 */
function apparentPolar(size: { radius: number; polar: number }, tilt: number) {
  const k = size.polar / size.radius;
  return Math.sqrt(k * k * Math.cos(tilt) ** 2 + Math.sin(tilt) ** 2);
}

/** The orbits' radii: the planets' mean semi-major axes at J2000 (the JPL table). */
const ORBIT_METRES = ORBIT_IDS.map((id) => convert(jplElements(id, 0).a, "au", "m"));
/** A radius's spread glows out to at most this share of it; more would swamp the body. */
const MAX_EDGE = 0.22;

export function createGiantsEngine(
  canvas: HTMLCanvasElement,
  host: HTMLElement,
  labels: HTMLElement,
  onError?: (error: unknown) => void,
): SimulationEngine {
  const resources = new DisposalScope();
  try {
    /* A flattened body stands as tall as its tilted pole makes it look (`apparentPolar`). */
    const sizes = RUNG_IDS.map((id, index) => {
      const size = radiusMetres(id);
      const look = LOOKS[index]!;
      return { ...size, polar: size.radius * apparentPolar(size, look.tilt), reach: look.reach };
    });
    const flattening = RUNG_IDS.map((id) => {
      const own = radiusMetres(id);
      return own.polar / own.radius;
    });
    const ladder = createLadder(sizes);
    const discs = {
      shape: vectors(MAX_DISCS),
      body: vectors(MAX_DISCS),
      surface: vectors(MAX_DISCS),
      globe: vectors(MAX_DISCS),
      ring: vectors(MAX_DISCS),
      lens: vectors(LENSES),
    };
    /** The black holes' rungs: they bend the stars whether or not they are in view. */
    const holes = LOOKS.flatMap((look, index) => (look.style === "horizon" ? [index] : [])).slice(
      0,
      LENSES,
    );
    const weather = resources.own(weatherUniforms());
    const forecast = createForecast();
    const tints = resources.own(discTints(LOOKS));
    const stellar = resources.own(stellarTables(LOOKS));
    const uniforms = {
      uResolution: { value: new Vector2(1, 1) },
      uPixelRatio: { value: 1 },
      uBaseline: { value: 0 },
      uTime: { value: 0 },
      uDetail: { value: 1 },
      uFocus: { value: new Vector2(-1, 0) },
      ...stellar.uniforms,
      uCount: { value: 0 },
      uShape: { value: discs.shape },
      uBody: { value: discs.body },
      uSurface: { value: discs.surface },
      uGlobe: { value: discs.globe },
      uRing: { value: discs.ring },
      uLens: { value: discs.lens },
      uTints: tints.uniform,
      uHoles: { value: Array.from({ length: LENSES }, () => 0) },
      uHoleCount: { value: 0 },
      uWeather: { value: new Vector4(-1, 0, 0, 0) },
      ...weather.uniforms,
      uOrbitCentre: { value: new Vector3() },
      uOrbits: { value: ORBIT_METRES.map(() => new Vector2()) },
      uAccent: { value: linearRgb(ACCENT_SRGB) },
      uBalmer: { value: linearRgb(BALMER_SRGB) },
      uAlkali: { value: new Vector3(...BROWN_DWARF_ALKALI) },
      uSky: { value: linearRgb(SPACE_SRGB) },
      uEarth: { value: null as Texture | null },
      uJupiter: { value: null as Texture | null },
      uMaps: { value: new Vector2(0, 0) },
      uEarthMean: { value: linearRgb(MAPS.earth?.mean ?? "#808080") },
      uJupiterMean: { value: linearRgb(MAPS.jupiter?.mean ?? "#808080") },
    };
    const blurRadii = new Float32Array(MAX_DISCS);
    const pass = resources.own(
      createFullscreenPass({
        canvas,
        vertexShader: fullscreenVertex,
        fragmentShader,
        uniforms,
        defines: SHADER_DEFINES,
        filter: {
          fragmentShader: focusBlurShader,
          uniforms: {
            uResolution: uniforms.uResolution,
            uPixelRatio: uniforms.uPixelRatio,
            uCount: uniforms.uCount,
            uShape: uniforms.uShape,
            uBlurRadius: { value: blurRadii },
            uBaseline: uniforms.uBaseline,
            uOrbitCentre: uniforms.uOrbitCentre,
            uOrbits: uniforms.uOrbits,
          },
        },
      }),
    );

    /* Earth and Jupiter wear their measured maps once they arrive; their mean colours till then. */
    const maps = new AbortController();
    resources.defer(() => maps.abort());
    const base = assetUrl(MAPS_KEY);
    (["earth", "jupiter"] as const).forEach((id, slot) => {
      loadMap(mapFile(base, id, "far"), maps.signal)
        .then((texture) => {
          if (maps.signal.aborted) return texture.dispose();
          resources.own(texture);
          if (id === "earth") uniforms.uEarth.value = texture;
          else uniforms.uJupiter.value = texture;
          if (slot === 0) uniforms.uMaps.value.x = 1;
          else uniforms.uMaps.value.y = 1;
          engine.invalidate();
        })
        .catch(() => {
          /* Offline or blocked: the globe keeps its mean colour. */
        });
    });
    /** Each body's globe as its turn and weather see it, and the pose a hand has given it. */
    const globes = LOOKS.map((look) => ({
      seed: look.seed,
      spin: look.spin,
      tilt: look.tilt,
      twist: 0,
      temperature: (look.equatorK + look.poleK) / 2,
    }));
    const poses = LOOKS.map(restPose);
    const posesRest = () => poses.every(poseRests);

    const reduce = prefersReducedMotion();
    const opening = useGiants.getState();
    let blurLevel = opening.focusBlur ? 1 : 0;
    /** The camera's place on the ladder, where it heads, its glide there, and the stage in CSS pixels. */
    let place = clampRung(ladder, opening.goal);
    let target = place;
    let glide = glideAt(place);
    let weatherFade = NO_WEATHER;
    let detailFade = NO_WEATHER;
    let seconds = glideSeconds(1);
    let lastFlight = opening.flight;
    let stage: Stage = { width: host.clientWidth || 1, height: host.clientHeight || 1 };
    /* The orbits belong to the body the camera has landed on; a visit that opens with them on has them already. */
    let orbitFade: HandOver = opening.orbits ? handOverAtOnce(nearestRung(ladder, place)) : NOBODY;
    let time = 0;
    let surfaceZoom: number = opening.surfaceZoom;
    let announced = false;
    let published = { place: Number.NaN, focus: -1, scale: 0 };
    let lastPublish = 0;

    const settled = () => glideRests(glide, target);
    const fly = (to: number) => {
      if (useGiants.getState().surfaceZoom !== 1) useGiants.getState().setSurfaceZoom(1);
      target = clampRung(ladder, to);
      seconds = glideSeconds(target - place);
      if (reduce) {
        place = target;
        glide = glideAt(place);
      }
      engine.invalidate();
    };
    const inputAllowed = () => !useGiants.getState().guideOpen;

    /* ---------------------------------------------------------------- input */

    let snapTimer: number | undefined;
    const snapSoon = () => {
      window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(() => fly(Math.round(target)), SNAP_DELAY_MS);
    };
    resources.defer(() => window.clearTimeout(snapTimer));

    const onWheel = (event: WheelEvent) => {
      if (!inputAllowed()) return;
      event.preventDefault();
      const pixels = wheelPixels(event.deltaY, event.deltaMode, host.clientHeight);
      const across = wheelPixels(event.deltaX, event.deltaMode, host.clientWidth);
      fly(target + ((pixels + across) / 100) * WHEEL_RUNGS);
      snapSoon();
    };
    host.addEventListener("wheel", onWheel, { passive: false });
    resources.defer(() => host.removeEventListener("wheel", onWheel));

    /**
     * One pointer's drag: where it started, how far it went, its recent speed in rungs a second,
     * and the globe it turns when it started on one (else it climbs the ladder).
     */
    let drag: {
      id: number;
      x: number;
      y: number;
      moved: number;
      last: number;
      velocity: number;
      globe: number | null;
    } | null = null;
    const grabbed = blankPlaced();
    /** A globe's radius on screen now, CSS px (the camera as the last frame placed it). */
    const radiusOnScreen = (index: number) =>
      placeBody(ladder, camera, stage, index, grabbed).radius;
    /** The globe under a point, if it has a surface to turn and is large enough to take hold of. */
    const globeAt = (clientX: number, clientY: number) => {
      const box = host.getBoundingClientRect();
      const index = bodyAt(ladder, place, stage, clientX - box.left, clientY - box.top, 10, camera);
      if (index === null || LOOKS[index]!.style === "horizon") return null;
      return radiusOnScreen(index) >= GRAB_MIN_PX ? index : null;
    };
    const climbOf = (dx: number, dy: number) => (-(dx + dy) / stage.height) * DRAG_RUNGS;
    const onDown = (event: PointerEvent) => {
      if (!inputAllowed() || (event.pointerType === "mouse" && event.button !== 0)) return;
      /* A body's name is a button: its own click opens the card, so it starts no drag. */
      if (event.target instanceof Element && event.target.closest("[data-rung]")) return;
      /* On a globe the hand turns it and leaves the camera be; elsewhere it takes the camera
         where it is, and a glide or a pending snap stops here. */
      const globe = globeAt(event.clientX, event.clientY);
      if (globe === null) {
        window.clearTimeout(snapTimer);
        target = place;
        glide = glideAt(place);
      }
      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        moved: 0,
        last: event.timeStamp,
        velocity: 0,
        globe,
      };
      host.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      drag.moved += Math.hypot(dx, dy);
      drag.x = event.clientX;
      drag.y = event.clientY;
      const dt = Math.max(1, event.timeStamp - drag.last) / 1000;
      drag.last = event.timeStamp;
      if (drag.globe !== null) {
        if (drag.moved <= TAP_SLOP_PX) return;
        const index = drag.globe;
        turnBy(poses[index]!, dx, dy, radiusOnScreen(index), LOOKS[index]!.tilt, dt);
        engine.invalidate();
        return;
      }
      const climb = climbOf(dx, dy);
      drag.velocity = 0.7 * drag.velocity + 0.3 * (climb / dt);
      if (drag.moved > TAP_SLOP_PX) {
        window.clearTimeout(snapTimer);
        target = clampRung(ladder, target + climb);
        place = target;
        glide = glideAt(place);
        engine.invalidate();
      }
    };
    const onUp = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      const ended = drag;
      drag = null;
      if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
      if (ended.moved <= TAP_SLOP_PX) {
        const box = host.getBoundingClientRect();
        const index = bodyAt(
          ladder,
          place,
          stage,
          event.clientX - box.left,
          event.clientY - box.top,
          10,
          camera,
        );
        if (index === null) return;
        useGiants.getState().goTo(RUNG_IDS[index]!);
        return;
      }
      const moving = event.timeStamp - ended.last < 80;
      /* A turned globe coasts if flicked, and later goes home by itself (`grab.ts`). */
      if (ended.globe !== null) return letGo(poses[ended.globe]!, moving);
      /* A flick carries on a little, then settles on a rung, the glide taking over the hand's speed. */
      const coast = moving ? ended.velocity * 0.18 : 0;
      fly(Math.round(clampRung(ladder, target + coast)));
      if (!reduce && moving) glide = glideFrom(place, ended.velocity, seconds);
    };
    host.addEventListener("pointerdown", onDown);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerup", onUp);
    host.addEventListener("pointercancel", onUp);
    resources.defer(() => {
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onUp);
    });

    const STEPS: Record<string, number | "first" | "last"> = {
      ArrowRight: 1,
      ArrowDown: 1,
      PageDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
      PageUp: -1,
      Home: "first",
      End: "last",
    };
    const onKey = (event: KeyboardEvent) => {
      const step = STEPS[event.key];
      if (step === undefined || !inputAllowed() || !isSceneShortcut(event)) return;
      event.preventDefault();
      const state = useGiants.getState();
      if (step === "first") state.go(0);
      else if (step === "last") state.go(ladder.last);
      else state.go(nearestRung(ladder, target) + step);
    };
    window.addEventListener("keydown", onKey);
    resources.defer(() => window.removeEventListener("keydown", onKey));

    /* --------------------------------------------------------------- frames */

    const engine = resources.own(
      createEngineHost({
        canvas,
        host,
        resolution: () => {
          const level = GIANTS_QUALITY[useGiants.getState().quality];
          return { scale: level.scale, dprCap: level.dprCap, dpr: window.devicePixelRatio || 1 };
        },
        onResize: (width, height) => {
          pass.resize(width, height);
          canvas.style.width = "100%";
          canvas.style.height = "100%";
          stage = { width: host.clientWidth || 1, height: host.clientHeight || 1 };
          uniforms.uResolution.value.set(width, height);
          uniforms.uPixelRatio.value = width / stage.width;
        },
        ...(onError !== undefined ? { onError } : {}),
      }),
    );

    const labelOf = (index: number) =>
      labels.querySelector<HTMLElement>(`[data-rung="${RUNG_IDS[index]}"]`);
    const labelEls = RUNG_IDS.map((_, index) => labelOf(index));
    const orbitEls = ORBIT_IDS.map((id) =>
      labels.querySelector<HTMLElement>(`[data-orbit="${id}"]`),
    );
    /**
     * Each orbit's name on its ring, like a contour's on a map: Mercury's, Earth's and Jupiter's
     * on top, the others' below, so neighbours stand twice as far apart. A ring too small to
     * name, or a name too close to the last one named on its side, is left out.
     */
    function moveOrbitLabels(x: number, y: number, rings: readonly Vector2[]) {
      const named = [-Infinity, -Infinity];
      orbitEls.forEach((el, k) => {
        if (!el) return;
        const { x: r, y: shown } = rings[k]!;
        const side = k % 2;
        const at = side === 0 ? y - r : y + r;
        const inside = x > 8 && x < stage.width - 8 && at > 60 && at < stage.height;
        const on =
          shown > 0 && r > ORBIT_LABEL_MIN_PX && r - named[side]! >= ORBIT_LABEL_GAP_PX && inside;
        if (on) {
          named[side] = r;
          el.style.transform = `translate(${x.toFixed(1)}px, ${at.toFixed(1)}px) translate(-50%, -50%)`;
        }
        /* Each name comes and goes with its ring. */
        const opacity = on ? shown.toFixed(3) : "0";
        if (el.style.opacity !== opacity) el.style.opacity = opacity;
        if ((el.dataset.shown === "true") !== on) el.dataset.shown = on ? "true" : "false";
      });
    }

    /** Each rung's name shown this frame (1) or not (0). */
    const named = new Uint8Array(RUNG_IDS.length);
    function moveLabels(focus: number) {
      named.fill(0);
      for (let i = 0; i < placedCount; i++) {
        const body = placed[i]!;
        const el = labelEls[body.index];
        if (!el) continue;
        const visible = body.index === focus || body.radius >= 9;
        if (!visible) continue;
        named[body.index] = 1;
        const top = Math.max(56, body.y - body.polar - 10);
        el.style.transform = `translate(${body.x.toFixed(1)}px, ${top.toFixed(1)}px) translate(-50%, -100%)`;
        el.dataset.focus = body.index === focus ? "true" : "false";
      }
      labelEls.forEach((el, index) => {
        if (!el) return;
        const on = named[index] === 1;
        if ((el.dataset.shown === "true") !== on) el.dataset.shown = on ? "true" : "false";
      });
    }

    /** The frame's scratch: the camera, the bodies in view (largest first) and a hole placed for its lens. */
    const camera: Camera = { scale: 0, centre: 0 };
    const placed: Placed[] = [];
    let placedCount = 0;
    const lensBody = blankPlaced();
    const ownerBody = blankPlaced();
    /** A body as this frame placed it (posed by a hand, if it was), or placed afresh if out of view. */
    function placedOf(index: number) {
      for (let i = 0; i < placedCount; i++) if (placed[i]!.index === index) return placed[i]!;
      return placeBody(ladder, camera, stage, index, ownerBody);
    }

    function frame(dt: number) {
      const state = useGiants.getState();
      blurLevel = fadeFocusBlur(blurLevel, state.focusBlur, dt, reduce);
      if (state.flight !== lastFlight) {
        lastFlight = state.flight;
        fly(state.goal);
      }
      if (!drag) {
        if (reduce) place = target;
        else {
          glide = glideTowards(glide, target, dt, seconds);
          place = clampRung(ladder, glide[2]);
          if (settled()) {
            place = target;
            glide = glideAt(target);
          }
        }
      }
      if (state.guideOpen && !state.guideLanded && Math.abs(place - state.goal) < 0.02)
        state.landGuide();
      if (!reduce) time += dt;
      poses.forEach((pose, index) => {
        const tilt = LOOKS[index]!.tilt;
        settlePose(pose, dt, tilt, reduce);
        globes[index]!.twist = pose.twist;
        globes[index]!.tilt = tilt + pose.pitch;
      });

      cameraAt(ladder, place, stage, camera);
      const zoomTarget = settled() ? state.surfaceZoom : 1;
      surfaceZoom = reduce
        ? zoomTarget
        : Math.exp(
            Math.log(surfaceZoom) +
              (Math.log(zoomTarget) - Math.log(surfaceZoom)) * (1 - Math.exp(-dt * 6)),
          );
      if (Math.abs(surfaceZoom - zoomTarget) < 0.001) surfaceZoom = zoomTarget;
      inspectCamera(camera, ladder, nearestRung(ladder, place), stage, surfaceZoom);
      placedCount = placeBodiesInto(placed, ladder, camera, stage);
      const count = Math.min(placedCount, MAX_DISCS);
      const focus = nearestRung(ladder, place);
      const resting =
        nearestRung(ladder, target) === focus && Math.abs(place - focus) < WEATHER_NEAR;
      const surfaceWanted =
        resting && !["earth", "jupiter", "horizon"].includes(LOOKS[focus]!.style) ? focus : -1;
      detailFade = reduce
        ? { star: surfaceWanted, level: surfaceWanted < 0 ? 0 : 1 }
        : fadeWeather(detailFade, surfaceWanted, dt);
      uniforms.uFocus.value.set(-1, 0);
      /* The star the camera lands on comes alive; one it passes through stays quiet. */
      const landing =
        nearestRung(ladder, target) === focus &&
        Math.abs(place - focus) < WEATHER_NEAR &&
        LOOKS[focus]!.activity !== "none";
      const wanted = landing ? focus : -1;
      weatherFade = reduce
        ? { star: wanted, level: wanted < 0 ? 0 : 1 }
        : fadeWeather(weatherFade, wanted, dt);
      const star = weatherFade.star;

      /* Each body drawn into its slot; the slots of the holes and of the star with weather. */
      let holesInView = 0;
      let slot = -1;
      for (let i = 0; i < count; i++) {
        const body = placed[i]!;
        const look = LOOKS[body.index]!;
        const globe = globes[body.index]!;
        /* A flattened globe tipped by hand stands as tall as its new tilt makes it look. */
        if (poses[body.index]!.pitch !== 0) {
          const shape = { radius: 1, polar: flattening[body.index]! };
          body.polar = Math.max(MIN_DISC_PX, body.radius * apparentPolar(shape, globe.tilt));
          body.y = (camera.horizon ?? horizonOf(stage)) - body.polar;
        }
        const edge = Math.min(MAX_EDGE, (body.high - body.low) / (2 * body.radius));
        discs.shape[i]!.set(body.x, body.y, body.radius, body.polar);
        blurRadii[i] = blurLevel * focusBlurRadius(body.index, place, body.radius);
        discs.body[i]!.set(STYLES.indexOf(look.style), look.equatorK, look.poleK, look.seed);
        discs.surface[i]!.set(look.cells, look.haze, Number.isFinite(edge) ? edge : 0, look.rough);
        discs.globe[i]!.set(turnAt(globe, time), globe.tilt, flattening[body.index]!, look.pulse);
        const ring = look.ring;
        if (ring) discs.ring[i]!.set(ring.glow, ring.kelvin, ring.flicker, ring.brightest);
        else discs.ring[i]!.set(0, 0, 0, 0);
        tints.assign(i, body.index);
        stellar.assign(i, body.index);
        const detail = surfaceDetail(body.index, detailFade, state.quality);
        if (detail > 0) uniforms.uFocus.value.set(i, detail);
        if (look.style === "horizon" && holesInView < LENSES)
          uniforms.uHoles.value[holesInView++] = i;
        if (body.index === star) slot = i;
      }
      uniforms.uHoleCount.value = holesInView;
      discs.lens.forEach((lens, k) => {
        const hole = holes[k];
        if (hole === undefined) return void lens.setW(0);
        const body = placeBody(ladder, camera, stage, hole, lensBody);
        lens.set(
          body.x,
          body.y,
          body.radius,
          smoothstep(LENS_GONE, LENS_FULL, Math.abs(place - hole)),
        );
      });
      const presence = weatherShown(weatherFade.level);
      const live = slot >= 0 && presence > 0;
      const forecastNow = live ? forecast.at(LOOKS[star]!.activity, globes[star]!, time) : null;
      weather.fill(forecastNow);
      uniforms.uWeather.value.set(
        live ? slot : -1,
        presence,
        forecastNow?.corona ?? 0,
        forecastNow?.chromosphere ?? 0,
      );
      uniforms.uCount.value = count;
      uniforms.uBaseline.value = camera.horizon ?? horizonOf(stage);
      uniforms.uTime.value = time;
      uniforms.uDetail.value = GIANTS_QUALITY[state.quality].detail ? 1 : 0;

      const { scale } = camera;
      /* The orbits ripple out round the body the camera lands on, as if it stood where the Sun
         does, and fade round it as the camera leaves, before coming in round the next. */
      const orbitsWanted = state.orbits && resting ? focus : -1;
      orbitFade = reduce
        ? handOverAtOnce(orbitsWanted)
        : handOver(orbitFade, orbitsWanted, dt, ORBIT_FADE_IN_S, ORBIT_FADE_OUT_S);
      const rings = uniforms.uOrbits.value;
      const around = orbitFade.level > 0 ? placedOf(orbitFade.owner) : null;
      if (around) {
        uniforms.uOrbitCentre.value.set(around.x, around.y, 1);
        ORBIT_METRES.forEach((m, k) => {
          const shown = ringShown(orbitFade.level, k, ORBIT_METRES.length);
          rings[k]!.set(ringRadius(m / scale, shown), shown);
        });
      } else {
        uniforms.uOrbitCentre.value.z = 0;
        rings.forEach((ring) => ring.setY(0));
      }
      moveOrbitLabels(around?.x ?? 0, around?.y ?? 0, rings);

      moveLabels(focus);
      pass.render({
        antialias: state.antialias,
        bloom: state.bloom ? bloomSettings(state.quality) : null,
        gamut: state.wideColour ? "p3" : "srgb",
        filter: blurLevel > 0,
      });

      const now = performance.now();
      /* A resize changes the scale without moving the camera: the ruler follows it too. */
      const moved =
        Math.abs(place - published.place) > 1e-3 ||
        Math.abs(scale - published.scale) > 1e-3 * scale;
      if (focus !== published.focus || (moved && (now - lastPublish > 60 || settled()))) {
        published = { place, focus, scale };
        lastPublish = now;
        state.publish(place, focus, scale);
      }
      if (!announced) {
        announced = true;
        state.setReady(true);
      }
    }
    pass.compile();
    engine.start({
      render: frame,
      paused: () => reduce && settled() && !engine.dirty && !drag && posesRest(),
      fps: () =>
        settled() && !drag && posesRest()
          ? IDLE_FPS
          : GIANTS_QUALITY[useGiants.getState().quality].fps,
    });
    resources.defer(
      useGiants.subscribe((state, previous) => {
        if (state.quality !== previous.quality) engine.refresh();
        if (
          state.flight !== previous.flight ||
          state.orbits !== previous.orbits ||
          state.bloom !== previous.bloom ||
          state.focusBlur !== previous.focusBlur ||
          state.wideColour !== previous.wideColour ||
          state.antialias !== previous.antialias ||
          state.quality !== previous.quality ||
          state.surfaceZoom !== previous.surfaceZoom
        )
          engine.invalidate();
        if (state.guideOpen && !previous.guideOpen) drag = null;
      }),
    );
    return { dispose: () => resources.dispose() };
  } catch (error) {
    resources.dispose();
    throw error;
  }
}
