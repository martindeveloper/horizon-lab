/**
 * The Sun lab's scene on the page: the shared model (`@/space/sun`) fed from the store's
 * choices, the renderer's engine (`engine.ts`) drawing its frame, and the store told what the
 * engine finds (a pick, the camera, the clock, a landing). The model's clock runs here: the
 * engine asks for model seconds to pass at the store's rate and the frame is read at that time.
 * The activity cycle runs with it: the cycle count is the map's at time zero, shifted when the
 * visitor sets the phase, and the scene writes the phase it stands at back to the store.
 */
import { audioMapNow } from "@/lib/audio-maps";
import { driftRunState, timedDrift } from "@/lib/drift";
import { bridgeStore, lendCamera } from "@/lib/scene-bridge";
import { MAP_EPOCH, SEEDED_GROUPS, createSunModel } from "@/space/sun/frame";
import { CORONA } from "@/space/sun/model/corona";
import {
  CYCLE_PERIOD_S,
  countAtPhase,
  cycleCountAt,
  cyclePhaseOf,
  yearOfCycleCount,
} from "@/space/sun/model/cycle";
import { RADIUS_M } from "@/space/sun/model/parameters";
import { PASSBANDS } from "@/space/sun/model/passbands";
import {
  LAYERS,
  generationAt,
  pressureScaleHeightAt,
  structureAt,
} from "@/space/sun/model/structure";
import type { DriftShot } from "@horizon/toolkit/camera";
import { lcg } from "@horizon/toolkit/math";
import { recordFrom } from "@horizon/toolkit/records";
import { DisposalScope, RENDER_QUALITIES, type SimulationEngine } from "@horizon/toolkit/rendering";
import type { SceneMount } from "@horizon/toolkit/scene";

import { DRIFT, type SunDriftShot } from "../drift";
import { SECONDS_PER_SECOND } from "../model/clock";
import type { PlaceId } from "../model/places";
import { sunQuality } from "../quality";
import { useSun, type SunStore } from "../store";
import { createSunEngine } from "./engine";
import { placeOfPick } from "./picking";
import type { SunSceneSettings } from "./settings";
import type { SunEngineHooks } from "./types";
import { OPENING_ANGLES, driftPose } from "./views";

/** The field lines the model traces at each quality, the same on every device. */
const FIELD_LINES = recordFrom(
  RENDER_QUALITIES,
  (quality) => sunQuality(quality, false).fieldLines,
);

/** The places whose cards, picked from the finder, ask the model to run the eruption at the dock's moment; a tap on one leaves the weather's own. */
const ERUPTION_PLACES: ReadonlySet<PlaceId> = new Set(["flare", "loops", "ejection"]);

/** The store's settings as the engine reads them each frame: built again only when the store changed. */
function createSettingsOf() {
  let state: SunStore | null = null;
  let settings: SunSceneSettings | null = null;
  return (s: SunStore) => {
    if (s !== state || !settings) {
      state = s;
      settings = settingsOf(s);
    }
    return settings;
  };
}

function settingsOf(s: SunStore): SunSceneSettings {
  return {
    view: s.view,
    closeUp: s.closeUp,
    ride: s.ride,
    cut: s.cut,
    fieldLines: s.show.fieldLines,
    names: s.show.names,
    grid: s.show.grid,
    light: PASSBANDS[s.light],
    layers: LAYERS,
    corona: CORONA,
    quality: s.quality,
    antialias: s.antialias,
    bloom: s.bloom,
    lens: s.lens,
    wideColour: s.wideColour,
  };
}

export type SunSceneOptions = {
  /** The model's seed and the model seconds lived past the map's epoch before the first frame (a bench replays them). */
  seed?: number;
  start?: number;
  /** A tier of the photograph has arrived, `finest` the quality's own (a bench waits for it). */
  onMap?: (finest: boolean) => void;
};

/**
 * A visit opens on the Sun as the map observed it (`MAP_EPOCH`, its regions the observed
 * ones), the statistical weather filling the other slots from a seed of the visit's own.
 */
const visitOptions = (): Required<Omit<SunSceneOptions, "onMap">> => ({
  seed: Math.floor(lcg(Date.now())() * 1e6),
  start: 0,
});

export function createSunScene(mount: SceneMount, options: SunSceneOptions = {}): SimulationEngine {
  const { seed, start } = { ...visitOptions(), ...options };
  const model = createSunModel(seed, { seeded: SEEDED_GROUPS });
  const store = useSun;
  /* Model seconds past the map's epoch: zero is the Sun as observed. */
  let time = start;
  /* The cycle count at the model's moment: the map's, shifted by what the visitor set. */
  let cycleShift = store.getState().cyclePhase - cyclePhaseOf(cycleCountAt(MAP_EPOCH));
  const cycleCount = () => cycleCountAt(MAP_EPOCH) + cycleShift + time / CYCLE_PERIOD_S;
  /** The cycle is still the Sun's own: the visitor has not moved it, so the photograph's groups stand. */
  const ownCycle = () => cycleShift === 0;
  /** The phase the scene last wrote to the store; any other value there is the visitor's ask. */
  let publishedPhase = store.getState().cyclePhase;
  const point = { T: 0, rho: 0, P: 0, L: 0, X: 0, kappa: 0 };
  /** The place last opened by a tap: it shows what is there, where the finder's pick stages its eruption. */
  let tapped: PlaceId | null = null;

  /** The frame at the model's moment, as the store wants it seen. */
  const frame = () => {
    const s = store.getState();
    /* A selection made since the tap is the finder's (or none). */
    if (s.selection !== tapped) tapped = null;
    const scrubbed =
      s.view === "eruption" ||
      (s.selection !== null && tapped === null && ERUPTION_PLACES.has(s.selection)) ||
      driftShot?.eruption !== undefined;
    return model.frameAt({
      time,
      cyclePhase: cycleCount(),
      light: s.light,
      eruptionScrub: scrubbed ? s.eruption : null,
      fieldLineCount: FIELD_LINES[s.quality],
      ownCycle: ownCycle(),
    });
  };

  /* The drift: each shot's pose from its view, timed to the track's map when it begins; as a
     flight lands on a shot, the shot's light, cut and eruption become the store's. */
  let driftShot: SunDriftShot | null = null;
  let landing = -1;
  let shots: readonly SunDriftShot[] = [];
  const driftShots = (): readonly DriftShot[] => {
    shots = timedDrift(DRIFT, audioMapNow(DRIFT.music?.track)).shots;
    landing = -1;
    driftShot = null;
    const f = frame();
    /* Every shot as a pose about the Sun's centre, a feature framed by where it looks. */
    return shots.map(
      ({ view, pose, look, roll, light: _light, cut: _cut, eruption: _e, ...shot }) => ({
        ...shot,
        ...driftPose(view, f, OPENING_ANGLES, { pose, look, roll }),
      }),
    );
  };
  const followDrift = () => {
    const index = engine.driftShot();
    if (index === landing) return;
    landing = index;
    const shot = shots[index];
    if (!shot) return;
    driftShot = shot;
    store.setState({
      view: shot.view,
      light: shot.light,
      cut: shot.cut ?? 0,
      ...(shot.eruption
        ? { eruption: shot.eruption[0], eruptionPlaying: true }
        : { eruptionPlaying: false }),
    });
  };

  /* The store's side of the scene (`bridgeStore`): what a frame writes is the scene's own. */
  const scope = new DisposalScope();
  let bridge: ReturnType<typeof bridgeStore<SunStore>> | null = null;

  const hooks: SunEngineHooks = {
    /* Each frame first takes the drift's shot as the store's (its view, light, cut, eruption). */
    frame: (draw) =>
      bridge
        ? bridge.frame(() => {
            followDrift();
            draw();
          })
        : draw(),
    interior: (r) => {
      structureAt(r, point);
      return {
        kelvin: point.T,
        density: point.rho,
        scaleHeight: r > 0 ? pressureScaleHeightAt(r) / RADIUS_M : 0,
        generation: generationAt(r),
      };
    },
    clock: () => {
      const s = store.getState();
      return { rate: SECONDS_PER_SECOND[s.clock], paused: s.paused };
    },
    advance: (seconds) => {
      time += seconds;
    },
    eruption: () => {
      const s = store.getState();
      return { s: s.eruption, playing: s.eruptionPlaying };
    },
    onEruption: (s) => store.setState({ eruption: s, eruptionPlaying: s < 1 }),
    publish: (modelSeconds, flareClass, cyclePhase) => {
      publishedPhase = cyclePhase;
      store.getState().publish({
        elapsed: modelSeconds - start,
        moment: MAP_EPOCH + modelSeconds * 1000,
        flareClass,
        cyclePhase,
        cycleYear: yearOfCycleCount(cycleCount()),
        photographed: ownCycle(),
      });
    },
    landed: () => store.getState().landGuide(),
    onPick: (pick) => {
      tapped = pick ? placeOfPick(pick) : null;
      store.getState().select(tapped);
    },
    onReadout: ({ heading, tilt, antialias }) => {
      const s = store.getState();
      store.setState({
        cameraAngles: { heading, tilt },
        ...(s.antialias === null ? { antialias } : {}),
      });
    },
    onReady: () => store.getState().setReady(true),
    onSharpening: (sharpening) => store.setState({ sharpening }),
    ...(options.onMap ? { onMap: options.onMap } : {}),
    onInput: () => {
      const s = store.getState();
      if (s.drift === "playing") s.pauseDrift();
    },
    drift: {
      shots: driftShots,
      settings: DRIFT.camera,
      state: () => driftRunState(store.getState().drift),
    },
  };

  const settings = createSettingsOf();
  const engine = createSunEngine(mount, () => settings(store.getState()), frame, hooks);
  const returnCamera = lendCamera(store, engine.camera);

  /* The store's asks the engine does not read from the settings: a flight to the view it is
     already on (a link, the finder), a button step; any change outside a frame redraws. */
  let { view, drift } = store.getState();
  bridge = bridgeStore(store, scope, {
    invalidate: () => engine.invalidate(),
    turn: (turn) => engine.turn(turn),
    fly: (s) => {
      if (s.view === view && !engine.driftFlying()) engine.flyToView(s.view);
    },
    before: (s) => {
      /* The visitor set the phase: shift the count to it, within the same cycle. */
      if (s.cyclePhase !== publishedPhase) {
        cycleShift += countAtPhase(cycleCount(), s.cyclePhase) - cycleCount();
        publishedPhase = s.cyclePhase;
      }
      if (s.drift === "off" && drift !== "off") {
        driftShot = null;
        landing = -1;
      }
    },
    after: (s) => {
      view = s.view;
      drift = s.drift;
    },
  });

  return {
    dispose: () => {
      scope.dispose();
      returnCamera();
      engine.dispose();
    },
  };
}
