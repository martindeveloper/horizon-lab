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

import { ambientMusic } from "@/components/shell/ambient-music";
import { audioMapNow } from "@/lib/audio-maps";
import { openingFor, timedDrift, type DriftState } from "@/lib/drift";
import { lendCamera, stageClearance } from "@/lib/scene-bridge";
import type { AudioMap } from "@horizon/toolkit/audio";
import { prefersReducedMotion } from "@horizon/toolkit/environment";
import { clamp, lerp, smootherstep, smoothstep } from "@horizon/toolkit/math";
import { DisposalScope, createEngineHost, type SimulationEngine } from "@horizon/toolkit/rendering";
import { createLineVeil } from "@horizon/toolkit/scene";

import { DRIFT } from "./drift";
import { createGiantsRenderer, ORBIT_METRES } from "./graphics/renderer";
import { vectors } from "./graphics/vectors";
import { createGiantsInput } from "./input";
import { createGiantsLabels } from "./labels";
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
import { letGo, nudge, poseRests, restPose, settlePose, turnBy } from "./model/grab";
import { NOBODY, handOver, handOverAtOnce, type HandOver } from "./model/hand-over";
import { inspectCamera } from "./model/inspection";
import {
  blankPlaced,
  cameraAt,
  clampRung,
  createLadder,
  horizonLift,
  horizonOf,
  nearestRung,
  pickPlaced,
  placeAtScale,
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
  glidePlaced,
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
  DRIFT_RESUME_S,
  GLIDE_SECONDS,
  GRAB_MIN_PX,
  HORIZON_LIFT_RATE,
  IDLE_FPS,
  MAX_DISCS,
  MIN_DISC_PX,
  ORBIT_FADE_IN_S,
  ORBIT_FADE_OUT_S,
  OVERVIEW_HOVER_PX,
  OVERVIEW_HOVER_SECONDS,
  RESTAGE_SECONDS,
  STYLES,
  LENSES,
  LENS_FULL,
  LENS_GONE,
  WEATHER_NEAR,
} from "./parameters";
import { GIANTS_QUALITY, bloomSettings } from "./quality";
import { comparedWith, useGiants, type GiantsStore } from "./store";

/**
 * A spheroid's silhouette height over its equatorial radius when its pole is tipped `tilt`
 * towards us: √(k² cos² tilt + sin² tilt), k its polar over equatorial radius.
 */
function apparentPolar(size: { radius: number; polar: number }, tilt: number) {
  const k = size.polar / size.radius;
  return Math.sqrt(k * k * Math.cos(tilt) ** 2 + Math.sin(tilt) ** 2);
}

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
    const forecast = createForecast();
    const {
      pass,
      discs,
      holes,
      tints,
      dotTable,
      stellar,
      weather,
      frameUniforms,
      bodyUniforms,
      activityUniforms,
      orbitUniforms,
      overviewUniforms,
      blurRadii,
    } = createGiantsRenderer(resources, canvas, () => engine.invalidate());
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
    /** Heads the camera for a place on the ladder, or there at once. */
    const head = (to: number) => {
      target = clampRung(ladder, to);
      seconds = glideSeconds(target - place);
      if (reduce) {
        place = target;
        glide = glideAt(place);
      }
      engine.invalidate();
    };
    /** A flight leaves the surface close-up. */
    const fly = (to: number) => {
      if (useGiants.getState().surfaceZoom !== 1) useGiants.getState().setSurfaceZoom(1);
      head(to);
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
    /**
     * The camera as the store borrows it for the `?` tour (`lendCamera`): its place to head back
     * to, which gives the surface close-up back once landed; a zoom along the ladder to the place
     * of that scale, as the wheel flies; and a turn of the globe in focus, as a flick.
     */
    resources.defer(
      lendCamera(useGiants, {
        mark: () => {
          const at = target;
          return () => {
            takeCamera();
            head(at);
          };
        },
        zoom: (factor) => {
          takeCamera();
          fly(placeAtScale(ladder, cameraAt(ladder, target, stage).scale * factor, stage));
        },
        turn: (step) => {
          const index = nearestRung(ladder, place);
          nudge(poses[index]!, step, LOOKS[index]!.tilt, reduce);
          engine.invalidate();
        },
      }),
    );
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
    const input = createGiantsInput(resources, host, {
      inputAllowed,
      surveying,
      stage: () => stage,
      pick: bodyUnder,
      globeAt,
      lastRung: ladder.last,
      turn: (index, dx, dy, dt) => {
        turnBy(poses[index]!, dx, dy, radiusOnScreen(index), LOOKS[index]!.tilt, dt);
        engine.invalidate();
      },
      release: (index, moving) => letGo(poses[index]!, moving),
      navigation: {
        paired: () => side !== null,
        take: takeCamera,
        nearest: () => nearestRung(ladder, target),
        snap: () => fly(Math.round(target)),
        stop: () => {
          if (side) pairTo(pairPlace(), true);
          else {
            takeCamera();
            holdHere();
          }
        },
        nudge: (by) => {
          if (side) pairTo(pairRail.target + by);
          else {
            takeCamera();
            fly(target + by);
          }
        },
        drag: (by) => {
          if (side) pairTo(pairRail.target + by, true);
          else {
            target = clampRung(ladder, target + by);
            place = target;
            glide = glideAt(place);
            engine.invalidate();
          }
        },
        coast: (by, velocity) => {
          if (side) return pairTo(pairRail.target + by);
          fly(Math.round(clampRung(ladder, target + by)));
          if (!reduce && velocity !== null) glide = glideFrom(place, velocity, seconds);
        },
      },
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
      names.hover(was, index);
      if (index === null) delete host.dataset.row;
      else host.dataset.row = RUNG_IDS[index];
      engine.invalidate();
    }
    const onHover = (event: PointerEvent) =>
      hover(
        event.pointerType === "mouse" && !input.dragging && surveying() && overviewLevel >= 1
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
          frameUniforms.uResolution.value.set(width, height);
          frameUniforms.uPixelRatio.value = width / stage.width;
        },
        ...(onError !== undefined ? { onError } : {}),
      }),
    );

    const names = createGiantsLabels(labels);

    /**
     * The frame's scratch: the camera, the bodies in view (largest first), every body's overview
     * dot as drawn (while the overview shows).
     */
    const camera: Camera = { scale: 0, centre: 0 };
    const placed: Placed[] = [];
    let placedCount = 0;
    /**
     * The bodies drawn this frame as they stand on the ladder, before the overview's glide moves
     * them towards their dots: a hole's ring and lensing stay with these while they fade, so
     * neither sweeps across the stage (`overviewAt`).
     */
    const stood: Placed[] = [];
    const dotsShown = RUNG_IDS.map(() => blankPlaced());
    /** Every body's dot in the overview, where its glide ends. */
    const dotTargets = RUNG_IDS.map(() => blankPlaced());
    /** How much of the stage's foot the dock covers, CSS px, as the dock publishes it (`--hud-clear`). */
    const dockFoot = () => parseFloat(getComputedStyle(host).getPropertyValue("--hud-clear")) || 0;
    /** How much of the stage's foot a card's sheet covers, CSS px (`--sheet-clear`), and the horizon's rise above it. */
    const sheetFoot = stageClearance(host, "--sheet-clear");
    const liftWanted = () => horizonLift(stage, sheetFoot());
    let lift = 0;
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
        const to = placeOverview(ladder, OVERVIEW_AXIS, stage, baseline, index, dotTargets[index]);
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
      if (!side || input.dragging || pairRests()) return;
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
    /** A body as it stands on the ladder this frame (`stood`), if it is among the `count` drawn. */
    function stoodOf(index: number, count: number) {
      for (let i = 0; i < count; i++) if (stood[i]!.index === index) return stood[i]!;
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
      if (!drifting && !input.dragging) {
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
      /* A sheet over the stage's foot lifts the horizon, so the body stands above it. */
      const liftTo = liftWanted();
      lift =
        reduce || Math.abs(liftTo - lift) < 0.5
          ? liftTo
          : lift + (liftTo - lift) * (1 - Math.exp(-dt * HORIZON_LIFT_RATE));
      if (lift > 0) camera.horizon = (camera.horizon ?? horizonOf(stage)) - lift;
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
      frameUniforms.uFocus.value.set(-1, 0);
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
        const stand = Object.assign((stood[i] ??= blankPlaced()), body);
        /* On the way to or from the overview, each full body glides with its dot, from where it
           truly stands rather than the dot's start at the stage's edge (`blendPlaced`), so a body
           far off the stage stays off it. A hole's ring and lensing keep its stand: even this
           glide's first moments shrink a far hole by a tenth, and a ring moved with it would
           sweep its glow across the stage faster than it fades. */
        if (overview.dots > 0) glidePlaced(body, dotTargets[body.index]!, overview.blend, body);
        const edge = Math.min(MAX_EDGE, (body.high - body.low) / (2 * body.radius));
        discs.shape[i]!.set(body.x, body.y, body.radius, body.polar);
        blurRadii[i] = blurShare * blurLevel * focusBlurRadius(body.index, place, body.radius);
        discs.body[i]!.set(STYLES.indexOf(look.style), look.equatorK, look.poleK, look.seed);
        discs.surface[i]!.set(look.cells, look.haze, Number.isFinite(edge) ? edge : 0, look.rough);
        discs.globe[i]!.set(turnAt(globe, time), globe.tilt, flattening[body.index]!, look.pulse);
        const ring = look.ring;
        if (ring)
          discs.ring[i]!.set(
            ring.glow * lightNow(body.index) * overview.light,
            ring.kelvin,
            ring.flicker,
            ring.brightest,
          );
        else discs.ring[i]!.set(0, 0, 0, 0);
        tints.assign(i, body.index);
        stellar.assign(i, body.index);
        const detail = surfaceDetail(body.index, detailFade, state.quality);
        if (detail > 0) frameUniforms.uFocus.value.set(i, detail);
        if (look.style === "horizon" && holesInView < LENSES) {
          discs.stand[holesInView]!.set(stand.x, stand.y, stand.radius, stand.polar);
          bodyUniforms.uHoles.value[holesInView++] = i;
        }
        if (body.index === star) slot = i;
      }
      bodyUniforms.uHoleCount.value = holesInView;
      discs.lens.forEach((lens, k) => {
        const hole = holes[k];
        if (hole === undefined) return void lens.setW(0);
        /* A hole bends the stars round its stretch of the ladder, side by side while it stands
           there, at the place it stands (not where its disc glides on the way to the overview).
           While the stage changes, its bending eases across if it stays, else goes early and comes
           late with its ring (`restageLens`). One not drawn bends from its place on the ladder;
           side by side, where it has none, its lens stays put. */
        const now = side
          ? Number(onStage(hole))
          : smoothstep(LENS_GONE, LENS_FULL, Math.abs(place - hole));
        const changing = restageLevel < 1;
        const drawnHole = stoodOf(hole, count);
        const before = lensFrom[k]!;
        const at = lensNow[k]!;
        if (drawnHole) at.set(drawnHole.x, drawnHole.y, drawnHole.radius, 0);
        else if (side) at.set(before.x, before.y, before.z, 0);
        else {
          const body = placeBody(ladder, camera, stage, hole, ownerBody);
          at.set(body.x, body.y, body.radius, 0);
        }
        at.w = changing ? restageLens(roleNow(hole), before.w, now, restageLevel) : now;
        lens.set(at.x, at.y, at.z, overview.light * at.w);
      });
      const presence = weatherShown(weatherFade.level);
      const live = slot >= 0 && presence > 0;
      const forecastNow = live ? forecast.at(LOOKS[star]!.activity, globes[star]!, time) : null;
      weather.fill(
        forecastNow,
        live ? (LOOKS[star]!.equatorK + LOOKS[star]!.poleK) / 2 : undefined,
      );
      activityUniforms.uWeather.value.set(
        live ? slot : -1,
        presence,
        forecastNow?.corona ?? 0,
        forecastNow?.chromosphere ?? 0,
      );
      bodyUniforms.uCount.value = count;
      overviewUniforms.uOverview.value = overview.dots;
      overviewUniforms.uDotFocus.value = focus;
      frameUniforms.uBaseline.value = baseline;
      frameUniforms.uTime.value = time;
      frameUniforms.uDetail.value = GIANTS_QUALITY[state.quality].detail ? 1 : 0;
      frameUniforms.uLines.value = smootherstep(lineVeil.presence);

      const { scale } = camera;
      /* The orbits ripple out round the body the camera lands on, as if it stood where the Sun
         does, and fade round it as the camera leaves, before coming in round the next. */
      const orbitsWanted = state.orbits && resting ? landed : -1;
      orbitFade = reduce
        ? handOverAtOnce(orbitsWanted)
        : handOver(orbitFade, orbitsWanted, dt, ORBIT_FADE_IN_S, ORBIT_FADE_OUT_S);
      const rings = orbitUniforms.uOrbits.value;
      const around = orbitFade.level > 0 ? placedOf(orbitFade.owner) : null;
      if (around) {
        orbitUniforms.uOrbitCentre.value.set(around.x, around.y, 1);
        ORBIT_METRES.forEach((m, k) => {
          const shown = ringShown(orbitFade.level, k, ORBIT_METRES.length);
          rings[k]!.set(ringRadius(m / scale, shown), shown);
        });
      } else {
        orbitUniforms.uOrbitCentre.value.z = 0;
        rings.forEach((ring) => ring.setY(0));
      }
      names.moveOrbitLabels(around?.x ?? 0, around?.y ?? 0, rings, stage);

      names.moveLabels({
        focus,
        stage,
        overviewLevel,
        dotsShown,
        placed,
        placedCount,
        onStage,
        small: side && restageLevel >= 1 && overviewLevel <= 0 ? placedOf(side.pair.small) : null,
      });
      /* A drift's loop fades through black on its seam: the canvas over the stage's own black. */
      const light = drifting ? driftFrame.light : 1;
      if (light !== driftLight) {
        driftLight = light;
        canvas.style.opacity = light < 1 ? light.toFixed(3) : "";
      }
      pass.render({
        antialias: state.antialias,
        bloom: state.bloom ? bloomSettings(state.quality, pass.hdr) : null,
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
      input.dragging ||
      !posesRest() ||
      flyingDrift() ||
      rejoin !== null ||
      lift !== liftWanted() ||
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
          state.surfaceZoom !== previous.surfaceZoom ||
          state.sheet !== previous.sheet
        )
          engine.invalidate();
        if (state.guideOpen && !previous.guideOpen) input.cancel();
      }),
    );
    return { dispose: () => resources.dispose() };
  } catch (error) {
    resources.dispose();
    throw error;
  }
}
