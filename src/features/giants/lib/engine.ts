/**
 * Giants' engine: the ladder drawn by one shader pass, the camera's place on it and the hands
 * that move it. A wheel or a drag glides the camera; when the hand lets go it settles on the
 * nearest rung, so stopping always lands on a body. A tap on a body opens its card. The store's
 * flights (a link, the stars panel, the guide) move it too. Each frame the engine places the
 * bodies (`ladder.ts`), fills the shader's discs, moves the names over them and tells the
 * store where the camera is. The overview glides every body from its place on the ladder to its
 * dot on a log scale (`overview.ts`), the full surfaces handing over to flat dots on the way, and
 * once there the stage stands still and draws nothing until something changes. Side by side
 * (`pair.ts`) stands two bodies from anywhere on the ladder next to each other, the camera on a
 * rail of their own; the others slide off the stage as they come on.
 */
import { Vector2, Vector3, Vector4, type Texture } from "three";

import { ambientMusic } from "@/components/shell/ambient-music";
import { assetUrl, MAPS_KEY } from "@/lib/assets";
import { audioMapNow } from "@/lib/audio-maps";
import { openingFor, timedDrift, type DriftState } from "@/lib/drift";
import type { AudioMap } from "@horizon/toolkit/audio";
import { MAPS, jplElements, mapFile } from "@horizon/toolkit/bodies";
import { TAP_SLOP_PX, wheelPixels } from "@horizon/toolkit/camera";
import { prefersReducedMotion } from "@horizon/toolkit/environment";
import { clamp, lerp, smootherstep, smoothstep } from "@horizon/toolkit/math";
import {
  DisposalScope,
  createEngineHost,
  createFullscreenPass,
  type SimulationEngine,
} from "@horizon/toolkit/rendering";
import { createLineVeil, loadMap } from "@horizon/toolkit/scene";
import { convert, decodeSrgb, hexToLinear } from "@horizon/toolkit/science";
import { fullscreenVertex } from "@horizon/toolkit/shaders";
import { isSceneShortcut } from "@horizon/toolkit/ui";

import { DRIFT } from "./drift";
import { overviewDots } from "./graphics/dots";
import focusBlurShader from "./graphics/focus-blur.frag.glsl";
import fragmentShader from "./graphics/giants.frag.glsl";
import { stellarTables } from "./graphics/stellar-tables";
import { discTints } from "./graphics/tints";
import { vectors } from "./graphics/vectors";
import { weatherUniforms } from "./graphics/weather-uniforms";
import { createForecast, turnAt } from "./model/activity";
import { radiusMetres } from "./model/catalogue";
import {
  blankDriftFrame,
  createDriftPath,
  framingOf,
  zoomPath,
  type DriftPath,
  type Framing,
} from "./model/drift-path";
import { fadeFocusBlur, focusBlurRadius, needsFocusBlur } from "./model/focus-blur";
import { glideAt, glideFrom, glideRests, glideSeconds, glideTowards } from "./model/glide";
import { letGo, poseRests, restPose, settlePose, turnBy } from "./model/grab";
import { NOBODY, handOver, handOverAtOnce, type HandOver } from "./model/hand-over";
import { inspectCamera } from "./model/inspection";
import {
  blankPlaced,
  cameraAt,
  clampRung,
  createLadder,
  horizonOf,
  nearestRung,
  pickPlaced,
  placeBodiesInto,
  placeBody,
  type Camera,
  type Ladder,
  type Placed,
  type Stage,
} from "./model/ladder";
import { LOOKS } from "./model/looks";
import { ringRadius, ringShown } from "./model/orbit-rings";
import {
  OVERVIEW_AXIS,
  blendPlaced,
  namesEnd,
  overviewAt,
  overviewBaseline,
  overviewRowAt,
  placeOverview,
  stepOverview,
  stepToward,
} from "./model/overview";
import {
  pairCamera,
  pairLadder,
  pairLanded,
  pairOf,
  pairStart,
  placePairInto,
  restageInto,
  restageLens,
  restageLight,
  roleIn,
  samePair,
  stepRestage,
  type Pair,
} from "./model/pair";
import { RUNG_IDS, rungIndex } from "./model/rungs";
import { surfaceDetail } from "./model/surface-detail";
import { NO_WEATHER, fadeWeather, weatherShown } from "./model/weather-fade";
import {
  ACCENT_SRGB,
  BALMER_SRGB,
  BROWN_DWARF_ALKALI,
  DRAG_RUNGS,
  DRIFT_RESUME_S,
  GLIDE_SECONDS,
  GRAB_MIN_PX,
  IDLE_FPS,
  MAX_DISCS,
  MIN_DISC_PX,
  ORBIT_FADE_IN_S,
  ORBIT_FADE_OUT_S,
  ORBIT_IDS,
  ORBIT_LABEL_GAP_PX,
  ORBIT_LABEL_MIN_PX,
  OVERVIEW_HOVER_PX,
  OVERVIEW_HOVER_SECONDS,
  OVERVIEW_LABEL_GAP_PX,
  PAIR_MARKER_PX,
  RESTAGE_SECONDS,
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
import { comparedWith, useGiants, type GiantsStore } from "./store";

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
    const forecast = createForecast();
    const tints = resources.own(discTints(LOOKS));
    const means = {
      earth: linearRgb(MAPS.earth?.mean ?? "#808080"),
      jupiter: linearRgb(MAPS.jupiter?.mean ?? "#808080"),
    };
    const dotTable = resources.own(overviewDots(LOOKS, tints.face, means));
    const stellar = resources.own(stellarTables(LOOKS));
    const weather = resources.own(weatherUniforms(stellar.spectrumData));
    const uniforms = {
      uResolution: { value: new Vector2(1, 1) },
      uPixelRatio: { value: 1 },
      uBaseline: { value: 0 },
      uTime: { value: 0 },
      uDetail: { value: 1 },
      uLines: { value: 1 },
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
      uEarthMean: { value: means.earth },
      uJupiterMean: { value: means.jupiter },
      uDots: dotTable.uniform,
      uOverview: { value: 0 },
      uDotFocus: { value: -1 },
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
    /** How far the glide into the overview has come, 0 (the ladder) to 1 (`stepOverview`). */
    let overviewLevel = opening.overview ? 1 : 0;
    /**
     * Side by side (`pair.ts`): the pair the stage shows and its own ladder (null: the ladder's
     * bodies); the camera's rail along the pair (0 the smaller framed, 1 the larger), its target
     * and glide; and how far a change of what stands on the stage has come, with the bodies as
     * drawn when it began.
     */
    let side: { pair: Pair; own: Ladder } | null = null;
    const pairRail = { target: 1, glide: glideAt(1), seconds: glideSeconds(1) };
    const pairPlace = () => pairRail.glide[2];
    const pairRests = () => glideRests(pairRail.glide, pairRail.target);
    let restageLevel = 1;
    const restageFrom: Placed[] = [];
    /**
     * Each hole's lens as last drawn (centre x, y; horizon radius; bending before the overview's
     * share), and as the stage change began: its bending eases from there into what the new stage
     * gives it, and a hole not on the stage keeps its lens where it was meanwhile.
     */
    const lensNow = vectors(LENSES);
    const lensFrom = vectors(LENSES);
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
    /** Moves the pair's camera towards `to` on its rail (held to it), or there at once. */
    function pairTo(to: number, now = false) {
      pairRail.target = clamp(to, 0, 1);
      pairRail.seconds = glideSeconds(pairRail.target - pairPlace());
      if (now || reduce) pairRail.glide = glideAt(pairRail.target);
      engine.invalidate();
    }
    const inputAllowed = () => !useGiants.getState().guideOpen;
    /** The overview shows: a hand only taps a body there, and a wheel goes back to the ladder. */
    const surveying = () => useGiants.getState().overview;

    /* ---------------------------------------------------------------- drift */

    /* The drift (lib/drift.ts) flies the camera itself while the store says it plays, timed by
       its track's published map, which its loader has fetched by then (`audioMapNow`), or as
       written until then. Its clock is seconds into the loop; a fresh start cuts to the opening
       shot behind the loader's curtain, a resume carries the camera back onto the path. */
    let drift: { map: AudioMap | null; path: DriftPath; opening: () => number } | null = null;
    const driftPath = () => {
      const map = audioMapNow(DRIFT.music?.track);
      if (drift?.map !== map) {
        const timed = timedDrift(DRIFT, map);
        const path = createDriftPath(timed, ladder);
        drift = {
          map,
          path,
          /* The camera meets the music where it is: it opens on the shot whose cue is nearest. */
          opening: () => path.opening(openingFor(timed, ambientMusic.position)),
        };
      }
      return drift;
    };
    const driftFrame = blankDriftFrame();
    let driftClock = 0;
    let driftWas: DriftState = "off";
    /** The canvas's light as the drift last set it (`seamLight`). */
    let driftLight = 1;
    /* The drift veils the line art: the baseline and the orbits fade, the bodies and the sky stay. */
    const lineVeil = createLineVeil();
    /** The framing last drawn, before the surface zoom. */
    let drawn: Framing = { centre: 0, width: 1 };
    /**
     * A handover between the drift's camera and the ladder's: the framing drawn and the surface
     * zoom when it began, how long it takes and how long since. The drift flies off the ladder's
     * own framings, so a pause, a hand or a resume eases from there onto the camera now in
     * charge along the smooth zoom rather than jumping.
     */
    let rejoin: { from: Framing; zoom: number; seconds: number; elapsed: number } | null = null;
    const rejoinFrom = (seconds: number) => {
      rejoin = { from: drawn, zoom: surfaceZoom, seconds, elapsed: 0 };
    };
    const flyingDrift = () => useGiants.getState().drift === "playing";
    /** The camera stays where the drift left it. */
    const holdHere = () => {
      target = place;
      glide = glideAt(place);
    };
    /** A hand on the camera pauses the drift and takes the camera from where the drift left it. */
    const takeCamera = () => {
      const state = useGiants.getState();
      if (state.drift !== "playing") return;
      state.pauseDrift();
      driftWas = "paused";
      holdHere();
      rejoinFrom(GLIDE_SECONDS);
    };
    /** How far the handover under way has come, 0–1 (1: none). */
    function stepRejoin(dt: number) {
      if (!rejoin) return 1;
      rejoin.elapsed += dt;
      return reduce ? 1 : smoothstep(0, rejoin.seconds, rejoin.elapsed);
    }
    /** The drift's step: its state's changes, then the camera where its clock has it. */
    function stepDrift(state: DriftState, dt: number, blend: number) {
      const was = driftWas;
      driftWas = state;
      if (state !== "playing") {
        if (was === "playing") {
          holdHere();
          rejoinFrom(state === "off" ? GLIDE_SECONDS : DRIFT_RESUME_S);
        }
        /* The drift ends: the camera settles on the body nearest where it heads, as a hand letting go does. */
        if (state === "off" && was !== "off" && was !== "loading") fly(Math.round(target));
        return false;
      }
      if (was !== "playing") {
        if (was === "paused") rejoinFrom(DRIFT_RESUME_S);
        else {
          rejoin = null;
          driftClock = driftPath().opening();
        }
      } else driftClock += dt;
      const frame = driftPath().path.at(driftClock, stage, reduce, driftFrame);
      place = frame.place;
      surfaceZoom = rejoin
        ? Math.exp(lerp(Math.log(rejoin.zoom), Math.log(frame.zoom), blend))
        : frame.zoom;
      glide = glideAt(place);
      /* The rung it heads for is the one whose star comes alive; those flown past stay quiet. */
      target = frame.heading;
      return true;
    }
    /** The ladder's framing for this frame: the drift's or the place's, eased from a handover's start. */
    function frameCamera(drifting: boolean, blend: number) {
      if (drifting) {
        camera.scale = driftFrame.scale;
        camera.centre = driftFrame.centre;
        delete camera.horizon;
      } else if (side) pairCamera(side.own, pairPlace(), stage, camera);
      else cameraAt(ladder, place, stage, camera);
      if (rejoin) {
        const framing = zoomPath(rejoin.from, framingOf(camera, stage)).at(blend);
        camera.scale = framing.width / stage.width;
        camera.centre = framing.centre;
        if (blend >= 1) rejoin = null;
      }
      drawn = framingOf(camera, stage);
    }

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
      /* A wheel over the overview goes back to the ladder, where the camera was. */
      if (surveying()) return useGiants.getState().setOverview(false);
      const pixels = wheelPixels(event.deltaY, event.deltaMode, host.clientHeight);
      const across = wheelPixels(event.deltaX, event.deltaMode, host.clientWidth);
      const by = ((pixels + across) / 100) * WHEEL_RUNGS;
      /* Side by side, the wheel zooms between the two and rests wherever it leaves them. */
      if (side) return pairTo(pairRail.target + by);
      takeCamera();
      fly(target + by);
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
    /**
     * The body under a stage point as the last frame drew it: the settled overview's whole row,
     * among the dots while they glide, else among the bodies on the stage.
     */
    const bodyUnder = (clientX: number, clientY: number) => {
      const box = host.getBoundingClientRect();
      const x = clientX - box.left;
      const y = clientY - box.top;
      if (overviewLevel >= 1) return overviewRowAt(ladder, dotsBaseline, y);
      if (overviewLevel > 0) return pickPlaced(dotsShown, dotsShown.length, x, y);
      return pickPlaced(placed, placedCount, x, y);
    };
    /** A globe's radius on screen now, CSS px (the camera as the last frame placed it). */
    const radiusOnScreen = (index: number) => placedOf(index).radius;
    /** The globe under a point, if it has a surface to turn and is large enough to take hold of. */
    const globeAt = (clientX: number, clientY: number) => {
      const index = bodyUnder(clientX, clientY);
      if (index === null || LOOKS[index]!.style === "horizon") return null;
      return radiusOnScreen(index) >= GRAB_MIN_PX ? index : null;
    };
    const climbOf = (dx: number, dy: number) => (-(dx + dy) / stage.height) * DRAG_RUNGS;
    const onDown = (event: PointerEvent) => {
      if (!inputAllowed() || (event.pointerType === "mouse" && event.button !== 0)) return;
      /* A body's name is a button: its own click opens the card, so it starts no drag. */
      if (event.target instanceof Element && event.target.closest("[data-rung]")) return;
      /* On a globe the hand turns it and leaves the camera be; elsewhere it takes the camera
         where it is, and a glide or a pending snap stops here. Over the overview it only taps. */
      const tapOnly = surveying();
      const globe = tapOnly ? null : globeAt(event.clientX, event.clientY);
      if (globe === null && !tapOnly && side) pairTo(pairPlace(), true);
      else if (globe === null && !tapOnly) {
        takeCamera();
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
      if (surveying()) return;
      const climb = climbOf(dx, dy);
      drag.velocity = 0.7 * drag.velocity + 0.3 * (climb / dt);
      if (drag.moved > TAP_SLOP_PX && side) pairTo(pairRail.target + climb, true);
      else if (drag.moved > TAP_SLOP_PX) {
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
        const index = bodyUnder(event.clientX, event.clientY);
        if (index === null) return;
        useGiants.getState().goTo(RUNG_IDS[index]!);
        return;
      }
      if (surveying()) return;
      const moving = event.timeStamp - ended.last < 80;
      /* A turned globe coasts if flicked, and later goes home by itself (`grab.ts`). */
      if (ended.globe !== null) return letGo(poses[ended.globe]!, moving);
      /* A flick carries on a little, then settles on a rung, the glide taking over the hand's
         speed; side by side it settles wherever it comes to rest on the pair's rail. */
      const coast = moving ? ended.velocity * 0.18 : 0;
      if (side) return pairTo(pairRail.target + coast);
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

    /* A mouse over a row of the settled overview lights its name and leader and grows its dot. */
    /** The row a mouse is over (null: none), and each dot's growth towards it, 0–1. */
    let hovered: number | null = null;
    const hoverLevels = new Float32Array(RUNG_IDS.length);
    const hoverBusy = () =>
      hoverLevels.some((level, index) => level !== (index === hovered ? 1 : 0));
    function hover(index: number | null) {
      if (index === hovered) return;
      const was = hovered;
      hovered = index;
      if (was !== null) labelEls[was]?.removeAttribute("data-hover");
      if (index !== null) labelEls[index]?.setAttribute("data-hover", "");
      if (index === null) delete host.dataset.row;
      else host.dataset.row = RUNG_IDS[index];
      engine.invalidate();
    }
    const onHover = (event: PointerEvent) =>
      hover(
        event.pointerType === "mouse" && !drag && surveying() && overviewLevel >= 1
          ? bodyUnder(event.clientX, event.clientY)
          : null,
      );
    const onLeave = () => hover(null);
    host.addEventListener("pointermove", onHover);
    host.addEventListener("pointerleave", onLeave);
    resources.defer(() => {
      host.removeEventListener("pointermove", onHover);
      host.removeEventListener("pointerleave", onLeave);
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
      takeCamera();
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
    const marker = labels.querySelector<HTMLElement>("[data-pair-marker]");
    const orbitEls = ORBIT_IDS.map((id) =>
      labels.querySelector<HTMLElement>(`[data-orbit="${id}"]`),
    );
    /** Each label's last transform, so a settled frame writes no style (the DOM normalises what it reads back). */
    const transforms = new WeakMap<HTMLElement, string>();
    function moveLabel(el: HTMLElement, x: number, y: number, anchor: string) {
      const transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) ${anchor}`;
      if (transforms.get(el) === transform) return;
      transforms.set(el, transform);
      el.style.transform = transform;
    }
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
          moveLabel(el, x, at, "translate(-50%, -50%)");
        }
        /* Each name comes and goes with its ring. */
        const opacity = on ? shown.toFixed(3) : "0";
        if (el.style.opacity !== opacity) el.style.opacity = opacity;
        if ((el.dataset.shown === "true") !== on) el.dataset.shown = on ? "true" : "false";
      });
    }

    /** Each rung's name shown this frame (1) or not (0). */
    const named = new Uint8Array(RUNG_IDS.length);
    /**
     * The bodies' names: over each body large enough to name on the ladder, in the overview's
     * column with a leader to every dot, and none while the bodies glide between.
     */
    function moveLabels(focus: number) {
      named.fill(0);
      if (overviewLevel >= 1)
        dotsShown.forEach((dot) => {
          const end = namesEnd(stage);
          nameAt(dot, focus, end, dot.y, "translate(-100%, -50%)");
          const el = labelEls[dot.index];
          if (el) lead(el, dot.x - dot.radius - OVERVIEW_LABEL_GAP_PX - end);
        });
      else if (overviewLevel <= 0)
        for (let i = 0; i < placedCount; i++) {
          const body = placed[i]!;
          if (body.index !== focus && body.radius < 9 && !onStage(body.index)) continue;
          const top = Math.max(56, body.y - body.polar - 10);
          nameAt(body, focus, body.x, top, "translate(-50%, -100%)");
        }
      labelEls.forEach((el, index) => {
        if (!el) return;
        const on = named[index] === 1;
        if ((el.dataset.shown === "true") !== on) el.dataset.shown = on ? "true" : "false";
      });
      markSmaller();
    }
    /** Side by side, the smaller body keeps a ring round it while it is too small to see. */
    function markSmaller() {
      if (!marker) return;
      const small =
        side && restageLevel >= 1 && overviewLevel <= 0 ? placedOf(side.pair.small) : null;
      const on = small !== null && small.radius < PAIR_MARKER_PX;
      if (small && on) moveLabel(marker, small.x, small.y, "translate(-50%, -50%)");
      if ((marker.dataset.shown === "true") !== on) marker.dataset.shown = on ? "true" : "false";
    }
    /** Each name's leader to its dot, CSS px, as last written. */
    const leaders = new WeakMap<HTMLElement, number>();
    /** A name's leader along its row to its dot, `length` CSS px (the stylesheet draws it in the overview). */
    function lead(el: HTMLElement, length: number) {
      const px = Math.max(0, Math.round(length));
      if (leaders.get(el) === px) return;
      leaders.set(el, px);
      el.style.setProperty("--leader", `${px}px`);
    }
    /** A body's name at a stage point, anchored there by `anchor`, marked if it is in focus. */
    function nameAt(body: Placed, focus: number, x: number, y: number, anchor: string) {
      const el = labelEls[body.index];
      if (!el) return;
      named[body.index] = 1;
      moveLabel(el, x, y, anchor);
      const focused = body.index === focus;
      if ((el.dataset.focus === "true") !== focused) el.dataset.focus = focused ? "true" : "false";
    }

    /**
     * The frame's scratch: the camera, the bodies in view (largest first), every body's overview
     * dot as drawn (while the overview shows).
     */
    const camera: Camera = { scale: 0, centre: 0 };
    const placed: Placed[] = [];
    let placedCount = 0;
    const dotsShown = RUNG_IDS.map(() => blankPlaced());
    const dotTarget = blankPlaced();
    /** How much of the stage's foot the dock covers, CSS px, as the dock publishes it (`--hud-clear`). */
    const dockFoot = () => parseFloat(getComputedStyle(host).getPropertyValue("--hud-clear")) || 0;
    /** The overview's baseline, CSS px from the stage's top, as the dots last stood on it and as last published to the stage's scale lines. */
    let dotsBaseline = 0;
    let baselinePublished = -1;
    /**
     * Every body's dot on its way from the ladder as `camera` sees it, `blend` of the way, over
     * the overview's baseline above the dock, which the scale lines read as `--overview-baseline`;
     * returns that baseline.
     */
    function placeDots(blend: number) {
      const baseline = overviewBaseline(stage, dockFoot());
      dotsBaseline = baseline;
      if (Math.round(baseline) !== baselinePublished) {
        baselinePublished = Math.round(baseline);
        host.style.setProperty("--overview-baseline", `${baselinePublished}px`);
      }
      dotsShown.forEach((dot, index) => {
        placeBody(ladder, camera, stage, index, dot);
        const to = placeOverview(ladder, OVERVIEW_AXIS, stage, baseline, index, dotTarget);
        blendPlaced(dot, to, blend, stage, dot);
        const grow = OVERVIEW_HOVER_PX * smoothstep(0, 1, hoverLevels[index]!);
        if (grow > 0) {
          dot.polar *= (dot.radius + grow) / dot.radius;
          dot.radius += grow;
        }
        dotTable.place(dot);
      });
      return baseline;
    }

    /** How far a rung's light reaches from its centre, radii: its ring, beams, corona or glow. */
    const reachOf = (index: number) => ladder.sizes[index]!.reach ?? 1;
    /** One of the bodies side by side, while they are. */
    const onStage = (index: number) =>
      side !== null && (index === side.pair.small || index === side.pair.large);
    /** The pair the store asks for: the body in focus beside the one it is measured against. */
    function pairWanted(state: GiantsStore, focus: number): Pair | null {
      const other = state.sideBySide ? comparedWith({ ...state, focus }) : null;
      return other ? pairOf(focus, rungIndex(other)) : null;
    }
    /**
     * Side by side's step: a new pair (or none) changes what stands on the stage, starting from
     * the bodies as last drawn, its camera on whichever of the two the stage framed before, then
     * gliding out to the larger; the camera glides along the pair's rail.
     */
    function stepPair(state: GiantsStore, focus: number, dt: number) {
      const wanted = pairWanted(state, focus);
      if (!samePair(wanted, side?.pair ?? null)) {
        const framed = side ? pairLanded(side.pair, pairPlace()) : focus;
        restageFrom.length = 0;
        for (let i = 0; i < placedCount; i++) restageFrom.push({ ...placed[i]! });
        lensFrom.forEach((lens, k) => lens.copy(lensNow[k]!));
        restageLevel = announced && restageFrom.length > 0 ? 0 : 1;
        side = wanted && { pair: wanted, own: pairLadder(ladder, wanted) };
        if (wanted) {
          pairRail.glide = glideAt(pairStart(wanted, framed));
          pairTo(1, !announced);
        }
      }
      restageLevel = stepRestage(restageLevel, dt, RESTAGE_SECONDS, reduce);
      if (!side || drag || pairRests()) return;
      pairRail.glide = glideTowards(pairRail.glide, pairRail.target, dt, pairRail.seconds);
      if (pairRests()) pairRail.glide = glideAt(pairRail.target);
    }
    /**
     * The bodies on the stage this frame, as `camera` sees them: the ladder's or the pair's, and
     * while the stage changes, blended from those drawn when it began (`restageInto`).
     */
    const staged: Placed[] = [];
    let stagedCount = 0;
    function placeStage() {
      stagedCount = side
        ? placePairInto(staged, side.own, side.pair, camera, stage)
        : placeBodiesInto(staged, ladder, camera, stage);
      if (restageLevel < 1) {
        placedCount = restageInto(
          placed,
          restageFrom,
          staged,
          stagedCount,
          restageLevel,
          stage,
          reachOf,
        );
        return;
      }
      for (let i = 0; i < stagedCount; i++) Object.assign((placed[i] ??= blankPlaced()), staged[i]);
      placedCount = stagedCount;
    }
    /** A rung's part in the stage change under way (`roleIn`), or null with none. */
    const roleNow = (index: number) =>
      restageLevel < 1 ? roleIn(restageFrom, staged, stagedCount, index) : null;
    /** How much of a body's far-reaching light shows now (`restageLight`). */
    const lightNow = (index: number) => {
      const role = roleNow(index);
      return role ? restageLight(role, restageLevel) : 1;
    };
    const ownerBody = blankPlaced();
    /** A body as this frame drew it (posed by a hand, if it was), if it is on the stage. */
    function drawnOf(index: number) {
      for (let i = 0; i < placedCount; i++) if (placed[i]!.index === index) return placed[i]!;
      return null;
    }
    /** A body as this frame placed it, or placed afresh on the ladder if out of view. */
    const placedOf = (index: number) =>
      drawnOf(index) ?? placeBody(ladder, camera, stage, index, ownerBody);

    function frame(dt: number) {
      const state = useGiants.getState();
      blurLevel = fadeFocusBlur(blurLevel, state.focusBlur, dt, reduce);
      if (state.flight !== lastFlight) {
        lastFlight = state.flight;
        takeCamera();
        fly(state.goal);
      }
      const blend = stepRejoin(dt);
      const drifting = stepDrift(state.drift, dt, blend);
      lineVeil.step(dt, state.drift === "off");
      if (!drifting && !drag) {
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
      const focus = nearestRung(ladder, place);
      stepPair(state, focus, dt);
      overviewLevel = stepOverview(overviewLevel, state.overview, dt, reduce);
      if (overviewLevel < 1) hover(null);
      hoverLevels.forEach((level, index) => {
        hoverLevels[index] = stepToward(
          level,
          index === hovered,
          dt,
          OVERVIEW_HOVER_SECONDS,
          reduce,
        );
      });
      const overview = overviewAt(overviewLevel);
      /* The full surfaces' share of the light: none once the dots have taken over. */
      const full = 1 - overview.dots;
      poses.forEach((pose, index) => {
        const tilt = LOOKS[index]!.tilt;
        settlePose(pose, dt, tilt, reduce);
        globes[index]!.twist = pose.twist;
        globes[index]!.tilt = tilt + pose.pitch;
      });

      frameCamera(drifting, blend);
      if (!drifting) {
        const zoomTarget = settled() ? state.surfaceZoom : 1;
        surfaceZoom = reduce
          ? zoomTarget
          : Math.exp(
              Math.log(surfaceZoom) +
                (Math.log(zoomTarget) - Math.log(surfaceZoom)) * (1 - Math.exp(-dt * 6)),
            );
        if (Math.abs(surfaceZoom - zoomTarget) < 0.001) surfaceZoom = zoomTarget;
      }
      if (!side) inspectCamera(camera, ladder, focus, stage, surfaceZoom);
      placeStage();
      const count = full > 0 ? Math.min(placedCount, MAX_DISCS) : 0;
      /* The line the bodies stand on: the ladder's horizon, easing down to the overview's baseline. */
      const horizon = camera.horizon ?? horizonOf(stage);
      const baseline =
        overview.dots > 0 ? lerp(horizon, placeDots(overview.blend), overview.blend) : horizon;
      /* Landed: surface detail, weather and orbits belong to the body the camera rests on, the
         one in focus on the ladder, the nearer framed of a pair side by side. */
      const landed = side ? pairLanded(side.pair, pairPlace()) : focus;
      const resting =
        overviewLevel === 0 &&
        !state.overview &&
        restageLevel >= 1 &&
        (side
          ? pairRests()
          : nearestRung(ladder, target) === focus && Math.abs(place - focus) < WEATHER_NEAR);
      const surfaceWanted =
        resting && !["earth", "jupiter", "horizon"].includes(LOOKS[landed]!.style) ? landed : -1;
      detailFade = reduce
        ? { star: surfaceWanted, level: surfaceWanted < 0 ? 0 : 1 }
        : fadeWeather(detailFade, surfaceWanted, dt);
      uniforms.uFocus.value.set(-1, 0);
      /* The star the camera lands on comes alive; one it passes through stays quiet. */
      const landing = resting && LOOKS[landed]!.activity !== "none";
      const wanted = landing ? landed : -1;
      weatherFade = reduce
        ? { star: wanted, level: wanted < 0 ? 0 : 1 }
        : fadeWeather(weatherFade, wanted, dt);
      const star = weatherFade.star;

      /* Each body drawn into its slot; the slots of the holes and of the star with weather. Side by
         side, both bodies stay sharp. */
      const blurShare = side ? 0 : full;
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
        /* On the way to or from the overview, each full body travels with its dot. */
        if (overview.dots > 0) Object.assign(body, dotsShown[body.index]!);
        const edge = Math.min(MAX_EDGE, (body.high - body.low) / (2 * body.radius));
        discs.shape[i]!.set(body.x, body.y, body.radius, body.polar);
        blurRadii[i] = blurShare * blurLevel * focusBlurRadius(body.index, place, body.radius);
        discs.body[i]!.set(STYLES.indexOf(look.style), look.equatorK, look.poleK, look.seed);
        discs.surface[i]!.set(look.cells, look.haze, Number.isFinite(edge) ? edge : 0, look.rough);
        discs.globe[i]!.set(turnAt(globe, time), globe.tilt, flattening[body.index]!, look.pulse);
        const ring = look.ring;
        if (ring)
          discs.ring[i]!.set(
            ring.glow * lightNow(body.index),
            ring.kelvin,
            ring.flicker,
            ring.brightest,
          );
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
        /* A hole bends the stars round its stretch of the ladder, side by side while it stands
           there, at the place it is drawn. While the stage changes, its bending eases across if it
           stays, else goes early and comes late with its ring (`restageLens`). One not drawn bends
           from its place on the ladder; side by side, where it has none, its lens stays put. */
        const now = side
          ? Number(onStage(hole))
          : smoothstep(LENS_GONE, LENS_FULL, Math.abs(place - hole));
        const changing = restageLevel < 1;
        const drawnHole = drawnOf(hole);
        const before = lensFrom[k]!;
        const at = lensNow[k]!;
        if (drawnHole) at.set(drawnHole.x, drawnHole.y, drawnHole.radius, 0);
        else if (side) at.set(before.x, before.y, before.z, 0);
        else {
          const body = placeBody(ladder, camera, stage, hole, ownerBody);
          at.set(body.x, body.y, body.radius, 0);
        }
        at.w = changing ? restageLens(roleNow(hole), before.w, now, restageLevel) : now;
        lens.set(at.x, at.y, at.z, full * at.w);
      });
      const presence = weatherShown(weatherFade.level);
      const live = slot >= 0 && presence > 0;
      const forecastNow = live ? forecast.at(LOOKS[star]!.activity, globes[star]!, time) : null;
      weather.fill(
        forecastNow,
        live ? (LOOKS[star]!.equatorK + LOOKS[star]!.poleK) / 2 : undefined,
      );
      uniforms.uWeather.value.set(
        live ? slot : -1,
        presence,
        forecastNow?.corona ?? 0,
        forecastNow?.chromosphere ?? 0,
      );
      uniforms.uCount.value = count;
      uniforms.uOverview.value = overview.dots;
      uniforms.uDotFocus.value = focus;
      uniforms.uBaseline.value = baseline;
      uniforms.uTime.value = time;
      uniforms.uDetail.value = GIANTS_QUALITY[state.quality].detail ? 1 : 0;
      uniforms.uLines.value = smootherstep(lineVeil.presence);

      const { scale } = camera;
      /* The orbits ripple out round the body the camera lands on, as if it stood where the Sun
         does, and fade round it as the camera leaves, before coming in round the next. */
      const orbitsWanted = state.orbits && resting ? landed : -1;
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
      /* A drift's loop fades through black on its seam: the canvas over the stage's own black. */
      const light = drifting ? driftFrame.light : 1;
      if (light !== driftLight) {
        driftLight = light;
        canvas.style.opacity = light < 1 ? light.toFixed(3) : "";
      }
      pass.render({
        antialias: state.antialias,
        bloom: state.bloom ? bloomSettings(state.quality) : null,
        gamut: state.wideColour ? "p3" : "srgb",
        filter:
          blurLevel > 0 && needsFocusBlur(discs.shape, blurRadii, count, stage.width, stage.height),
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
    /** Something on the stage moves by itself: the camera, a globe, the drift or the line art's veil. */
    const moving = () =>
      !settled() ||
      overviewLevel !== (surveying() ? 1 : 0) ||
      (side !== null && !pairRests()) ||
      restageLevel < 1 ||
      hoverBusy() ||
      drag !== null ||
      !posesRest() ||
      flyingDrift() ||
      rejoin !== null ||
      lineVeil.busy;
    pass.compile();
    engine.start({
      render: frame,
      /* Reduced motion, or the overview at rest, draws only what changes. */
      paused: () => (reduce || (surveying() && overviewLevel === 1)) && !engine.dirty && !moving(),
      fps: () => (moving() ? GIANTS_QUALITY[useGiants.getState().quality].fps : IDLE_FPS),
    });
    resources.defer(
      useGiants.subscribe((state, previous) => {
        if (state.quality !== previous.quality) engine.refresh();
        if (
          state.flight !== previous.flight ||
          state.drift !== previous.drift ||
          state.orbits !== previous.orbits ||
          state.overview !== previous.overview ||
          state.sideBySide !== previous.sideBySide ||
          state.reference !== previous.reference ||
          state.otherBody !== previous.otherBody ||
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
