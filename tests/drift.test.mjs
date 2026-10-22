import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createStore } from "zustand/vanilla";

import { parseAudioMap } from "@horizon/toolkit/audio";
import { DRIFT_DEFAULTS, createDriftCamera, createDriftRun } from "@horizon/toolkit/camera";

import { MUSIC_LEVEL, ambientMusic } from "../src/components/shell/ambient-music.ts";
import {
  DRIFT as BLACK_HOLE,
  DORMANT_DRIFT as BLACK_HOLE_DORMANT,
  LOOK_LIMIT,
} from "../src/features/black-hole/lib/drift.ts";
import { MAX_DIST, MIN_DIST } from "../src/features/black-hole/lib/physics.ts";
import { useBlackHole } from "../src/features/black-hole/lib/store.ts";
import { DRIFT as DEEP_FIELD } from "../src/features/deep-field/lib/drift.ts";
import { VIEW_IDS } from "../src/features/deep-field/lib/model/view-ids.ts";
import { viewById, worldDistance } from "../src/features/deep-field/lib/model/views.ts";
import { useDeepField } from "../src/features/deep-field/lib/store.ts";
import { DRIFT as GIANTS } from "../src/features/giants/lib/drift.ts";
import { createDriftPath } from "../src/features/giants/lib/model/drift-path.ts";
import { RUNG_IDS } from "../src/features/giants/lib/model/rungs.ts";
import { WEATHER_NEAR } from "../src/features/giants/lib/parameters.ts";
import { useGiants } from "../src/features/giants/lib/store.ts";
import { DRIFT as ORRERY } from "../src/features/orrery/lib/drift.ts";
import { canCloseUp, useOrrery } from "../src/features/orrery/lib/store.ts";
import {
  DRIFT_LOADING,
  driftReady,
  driftSlice,
  openingFor,
  seamLight,
  timedDrift,
  timeShots,
} from "../src/lib/drift.ts";
import { HELIOPAUSE_AU } from "../src/space/solar-system/model/probes.ts";
import { isSolarView } from "../src/space/solar-system/model/views.ts";

const PROGRAMMES = {
  "deep-field": DEEP_FIELD,
  orrery: ORRERY,
  "black-hole": BLACK_HOLE,
  "black-hole-dormant": BLACK_HOLE_DORMANT,
  giants: GIANTS,
};

test("every drift programme is one the camera and the music can play", () => {
  const titles = new Set(ambientMusic.tracks.map((track) => track.title));
  for (const [name, programme] of Object.entries(PROGRAMMES)) {
    assert.ok(programme.shots.length >= 2, `${name} has shots to go between`);
    if (programme.music?.track)
      assert.ok(titles.has(programme.music.track), `${name}: its track is in the playlist`);
    for (const key of Object.keys(programme.camera))
      assert.ok(key in DRIFT_DEFAULTS, `${name}: camera setting ${key} exists`);
    for (const shot of programme.shots) {
      if ("handoff" in shot || "closeUp" in shot) continue;
      for (const [key, value] of Object.entries({ ...shot.flight, hold: shot.hold })) {
        if (value !== undefined && key !== "lead" && key !== "swing" && key !== "lift")
          assert.ok(value > 0, `${name}: ${key} is a positive time`);
      }
    }
  }
  for (const shot of DEEP_FIELD.shots) {
    assert.ok(VIEW_IDS.includes(shot.view), `deep field view ${shot.view}`);
    /* Just outside the heliopause its bubble fills the frame: no hold may land or creep there,
       at any spread of the distance (±0.3 e-folds at full variance). */
    const distance = shot.pose?.distance ?? worldDistance(viewById(shot.view).ly);
    const spread = Math.exp(0.3 * (DEEP_FIELD.camera.variance ?? DRIFT_DEFAULTS.variance));
    const creep = shot.creep ?? DEEP_FIELD.camera.creep ?? DRIFT_DEFAULTS.creep;
    const nearest = (distance / spread) * Math.min(1, 1 - creep);
    const farthest = distance * spread * Math.max(1, 1 - creep);
    assert.ok(
      farthest < HELIOPAUSE_AU || nearest > HELIOPAUSE_AU * 2,
      `deep field ${shot.view} holds clear of the heliopause (${nearest}–${farthest} au)`,
    );
  }
  for (const shot of ORRERY.shots) {
    if ("closeUp" in shot) {
      assert.ok(
        canCloseUp({ selection: shot.closeUp, guideOpen: false, yearsAgo: 0 }),
        `orrery close-up ${JSON.stringify(shot.closeUp)}`,
      );
    } else assert.ok(isSolarView(shot.view), `orrery view ${shot.view}`);
  }
  assert.ok(
    ORRERY.shots.some((shot) => "closeUp" in shot),
    "the Orrery's drift visits bodies",
  );
  assert.ok(
    ORRERY.clock > 0 && ORRERY.clock < 0.35,
    "the drift's clock runs below Motion's slowest rate",
  );
  assert.ok(ORRERY.closeUp.dive > 0 && ORRERY.closeUp.dive <= 1 && ORRERY.closeUp.hold > 0);
  assert.ok(ORRERY.closeUp.pace > 1, "a drift's close-up flights are slower than a tap's");
  for (const programme of [BLACK_HOLE, BLACK_HOLE_DORMANT]) {
    const spread = Math.exp(0.3 * (programme.camera.variance ?? DRIFT_DEFAULTS.variance));
    for (const shot of programme.shots) {
      assert.ok(
        shot.distance >= MIN_DIST && shot.distance <= MAX_DIST,
        `hole distance ${shot.distance}`,
      );
      const creep = shot.creep ?? programme.camera.creep ?? DRIFT_DEFAULTS.creep;
      assert.ok(
        shot.distance * (1 - creep) >= MIN_DIST,
        "the hold's push keeps above the camera's floor",
      );
      /* Closer than this a dormant hole's shadow fills the frame, at any spread of the distance. */
      if (programme === BLACK_HOLE_DORMANT)
        assert.ok((shot.distance / spread) * (1 - creep) >= 6, `dormant hold at ${shot.distance}`);
      /* The hole never leaves the frame: no shot looks away to empty sky. */
      const look = shot.look ?? { yaw: 0, pitch: 0 };
      assert.ok(
        Math.abs(look.yaw) <= LOOK_LIMIT.yaw && Math.abs(look.pitch) <= LOOK_LIMIT.pitch,
        `the hole stays in frame at ${shot.distance} M (yaw ${look.yaw}, pitch ${look.pitch})`,
      );
    }
  }
  /* Both are timed to their track: as written, a loop is the track's period; by the track's
     map (the fixture mirrors the published one), every cue a shot names exists and the cued
     shots meet them, the loop still the period; and the camera opens on the shot whose cue the
     music is nearest. */
  for (const programme of [BLACK_HOLE, BLACK_HOLE_DORMANT, DEEP_FIELD, ORRERY, GIANTS]) {
    const slug = programme.music.track.toLowerCase().replaceAll(" ", "-");
    const loops = programme.music.loops ?? 1;
    const map = parseAudioMap(
      JSON.parse(
        readFileSync(new URL(`../bench/fixtures/audio-maps/${slug}.json`, import.meta.url), "utf8"),
      ),
    );
    assert.ok(map, `${slug} has a fixture map`);
    assert.ok(
      Math.abs(map.period - programme.music.period) <= 0.5,
      "the written period is the map's",
    );
    const written = timedDrift(programme, null);
    assert.ok(
      Math.abs(written.loop - programme.music.period * loops) <= 2,
      `written loop ${written.loop}`,
    );
    const timed = timedDrift(programme, map);
    assert.ok(
      Math.abs(timed.loop - map.period * loops) <= 0.5,
      `timed loop ${timed.loop} vs ${map.period * loops}`,
    );
    /* A cue in a later play of the track: `peak@2`. */
    const cue = (id) => {
      const [name, play = "1"] = id.split("@");
      const at = map.cues.find((c) => c.id === name)?.at;
      return at === undefined ? undefined : at + (Number(play) - 1) * map.period;
    };
    timed.shots.forEach((shot, i) => {
      assert.ok(shot.hold >= 1, `${slug} shot ${i} holds ${shot.hold}`);
      if (shot.at !== undefined) {
        assert.ok(cue(shot.at) !== undefined, `${slug} has cue ${shot.at}`);
        assert.ok(
          Math.abs(timed.starts[i] - cue(shot.at)) <= 0.2,
          `shot ${i} begins on ${shot.at}`,
        );
      }
      if (shot.land !== undefined) {
        assert.ok(cue(shot.land) !== undefined, `${slug} has cue ${shot.land}`);
        const lands = timed.starts[i] + (shot.flight?.duration ?? programme.camera.flight);
        assert.ok(Math.abs(lands - cue(shot.land)) <= 0.2, `shot ${i} lands on ${shot.land}`);
      }
    });
    /* Lengths never vary between loops, whatever the spread of angles: at the widest spread the
       first flight still lands exactly when written (shots framed by a rig are posed elsewhere). */
    if (!("distance" in timed.shots[0])) continue;
    const camera = createDriftCamera(timed.shots, {
      ...programme.camera,
      random: () => 1,
      opening: () => 0,
    });
    camera.start({ azimuth: 0, inclination: 0, distance: 30 });
    let frames = 1;
    while (!camera.step(1 / 60).landed && frames < 10_000) frames++;
    const duration = timed.shots[0].flight?.duration ?? programme.camera.flight;
    assert.ok(Math.abs(frames / 60 - duration) <= 2 / 60, `${slug} flight of ${frames / 60} s`);
    const { starts, period } = timed;
    assert.equal(openingFor(timed, null), 0);
    assert.equal(openingFor(timed, 1), 0);
    assert.equal(openingFor(timed, starts[2] - 3), 2);
    assert.equal(openingFor(timed, starts[2] + 3), 2);
    assert.equal(openingFor(timed, period - 2), 0, "the loop's end is its start");
    assert.equal(openingFor(timed, period + starts[3]), 3, "positions wrap");
  }
  /* Timing by cues: holds stretch to meet them; a missing cue leaves the stretch as written. */
  const map = {
    version: 1,
    track: "t",
    duration: 108,
    period: 100,
    step: 1,
    loudness: [],
    brightness: [],
    cues: [
      { id: "start", kind: "start", at: 0 },
      { id: "peak", kind: "peak", at: 60 },
      { id: "end", kind: "end", at: 100 },
    ],
  };
  const camera = { flight: 10, hold: 10 };
  const shots = [
    { at: "start", azimuth: 0, inclination: 0, distance: 10 },
    { azimuth: 1, inclination: 0, distance: 10 },
    { land: "peak", azimuth: 2, inclination: 0, distance: 10, flight: { duration: 20 } },
    { azimuth: 3, inclination: 0, distance: 10 },
  ];
  const timed = timeShots({ camera, shots }, map);
  assert.equal(timed.period, 100);
  /* The last cued hold runs to the loop's end. */
  assert.deepEqual(
    timed.shots.map((s) => s.hold ?? camera.hold),
    [10, 10, 20, 10],
  );
  const stretched = timeShots({ camera, shots: [shots[0], shots[2], shots[3]] }, map);
  assert.deepEqual(
    stretched.shots.map((s) => s.hold ?? camera.hold),
    [30, 20, 10],
  );
  const missing = timeShots({ camera, shots: [{ ...shots[0], at: "nothing" }, shots[1]] }, map);
  assert.deepEqual(
    missing.shots.map((s) => s.hold),
    [undefined, undefined],
  );
  assert.equal(timeShots({ camera, shots, music: { period: 42 } }, null).period, 42);
  assert.ok(MUSIC_LEVEL.drift > MUSIC_LEVEL.ambient, "a drift lifts the music");
});

test("a loop that fades through black is dark on its seam and fully lit away from it", () => {
  assert.equal(seamLight(0, 100, 3), 0);
  assert.equal(seamLight(100, 100, 3), 0, "the loop's end is its start");
  assert.equal(seamLight(50, 100, 3), 1);
  assert.ok(seamLight(1.5, 100, 3) > 0 && seamLight(1.5, 100, 3) < 1);
  assert.equal(seamLight(1.5, 100, 3), seamLight(98.5, 100, 3), "out as it comes in");
  assert.equal(seamLight(0, 100, undefined), 1, "a loop without a fade flies on lit");
});

test("Giants' drift climbs without turning back, keeps each held star alive and zooms about one body", () => {
  const slug = GIANTS.music.track.toLowerCase().replaceAll(" ", "-");
  const map = parseAudioMap(
    JSON.parse(
      readFileSync(new URL(`../bench/fixtures/audio-maps/${slug}.json`, import.meta.url), "utf8"),
    ),
  );
  for (const timed of [timedDrift(GIANTS, map), timedDrift(GIANTS, null)]) {
    const path = createDriftPath(timed);
    const last = RUNG_IDS.length - 1;
    let previous = -Infinity;
    for (let t = 0; t < path.loop; t += 0.05) {
      const frame = path.at(t);
      assert.ok(frame.place >= previous - 1e-9, `the camera climbs at ${t.toFixed(2)} s`);
      assert.ok(frame.place >= 0 && frame.place <= last, `on the ladder at ${t.toFixed(2)} s`);
      previous = frame.place;
      /* The surface zoom magnifies about the body nearest the camera: it may only be on while
         that body is the one the shot is at, or the view would jump where the nearest changes. */
      if (frame.zoom > 1.001)
        assert.equal(Math.round(frame.place), frame.heading, `zoomed about its body at ${t} s`);
    }
    timed.shots.forEach((shot, i) => {
      const [from, to] = shot.creep;
      assert.ok(from <= to, `shot ${i} creeps up the ladder`);
      assert.ok(Math.max(-from, to) < WEATHER_NEAR, `shot ${i}'s hold keeps its star alive`);
      /* Each hold sits where it was written, from its start to its end. */
      const start = path.opening(i);
      const end = start + shot.hold + (i === 0 ? shot.flight.duration : 0);
      const rung = RUNG_IDS.indexOf(shot.rung);
      assert.ok(Math.abs(path.at(start).place - (rung + from)) < 1e-9, `shot ${i} begins its hold`);
      assert.ok(Math.abs(path.at(end - 1e-6).place - (rung + to)) < 1e-4, `shot ${i} ends it`);
      assert.equal(path.at(start + 0.01).heading, rung);
    });
    assert.equal(path.at(0).light, 0, "the loop starts out of black");
    assert.equal(path.at(path.loop / 2).light, 1);
    /* Reduced motion: each flight cuts to its shot, each hold stands at its start. */
    const still = path.at(path.opening(1) + 1, true);
    assert.equal(still.place, RUNG_IDS.indexOf(timed.shots[1].rung) + timed.shots[1].creep[0]);
  }
});

test("a cut lands the camera on the opening shot behind the curtain; a resume flies", () => {
  const shots = [
    { azimuth: 1, inclination: 0.2, distance: 10, roll: 0.1, look: { yaw: 0.3, pitch: 0 } },
    { azimuth: 2, inclination: 0.4, distance: 20 },
  ];
  const settings = { flight: 10, hold: 5, variance: 0, sway: 0, drift: 0, creep: 0 };
  const far = { azimuth: 0, inclination: 0, distance: 100 };
  const flown = createDriftCamera(shots, settings);
  flown.start(far);
  assert.ok(flown.flying, "without a cut the camera flies to the opening shot");
  assert.equal(flown.pose.distance, 100);
  const cut = createDriftCamera(shots, { ...settings, cut: true });
  cut.start(far);
  assert.ok(!cut.flying, "a cut begins landed");
  assert.equal(cut.pose.azimuth, 1);
  assert.equal(cut.pose.distance, 10);
  assert.equal(cut.pose.roll, 0.1);
  assert.equal(cut.pose.look.yaw, 0.3);
  /* The skipped flight's length goes to the hold: the next flight begins when it would have. */
  let frames = 0;
  while (cut.index === 0 && frames < 10_000) {
    cut.step(1 / 60);
    frames++;
  }
  assert.ok(Math.abs(frames / 60 - 15) <= 2 / 60, `next flight after ${frames / 60} s`);
  /* A run cuts on a start from off, and flies from the visitor's camera after a pause. */
  const run = createDriftRun(shots, { ...settings, cut: true });
  const first = run.step("playing", far, 1 / 60);
  assert.ok(first.started && first.pose && first.pose.distance === 10, "fresh start cuts");
  run.step("paused", far, 1 / 60);
  const resumed = run.step("playing", { ...far, distance: 50 }, 1 / 60);
  assert.ok(resumed.started && resumed.pose, "a resume starts the camera again");
  assert.ok(
    resumed.pose.distance > 20 && resumed.pose.distance <= 50,
    "and flies from the visitor's pose",
  );
  const stopped = run.step("off", far, 1 / 60);
  assert.ok(stopped.ended);
  const again = run.step("playing", far, 1 / 60);
  assert.equal(again.pose?.distance, 10, "the next fresh start cuts again");
});

test("an unveil plays once on a cut: rests looking away, turns onto the shot, never on a wrap", () => {
  const shots = [
    {
      azimuth: 0,
      inclination: 0,
      distance: 10,
      look: { yaw: -0.3, pitch: 0 },
      unveil: { look: { yaw: -1.5, pitch: 0.2 }, rest: 2, turn: 4 },
      flight: { duration: 2 },
      hold: 6,
    },
    { azimuth: 1, inclination: 0, distance: 10, flight: { duration: 2 }, hold: 1 },
  ];
  const settings = { variance: 0, sway: 0, drift: 0, creep: 0, opening: () => 0 };
  const run = (seconds, camera) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) camera.step(1 / 60);
  };
  const camera = createDriftCamera(shots, settings);
  camera.start({ azimuth: 0, inclination: 0, distance: 10 }, { cut: true });
  assert.equal(camera.pose.look.yaw, -1.5, "the cut opens looking away");
  run(1.5, camera);
  assert.equal(camera.pose.look.yaw, -1.5, "and rests there");
  run(2.5, camera);
  const mid = camera.pose.look.yaw;
  assert.ok(mid > -1.5 && mid < -0.3, `then turns (${mid})`);
  run(2.5, camera);
  assert.equal(camera.pose.look.yaw, -0.3, "onto the shot's own look");
  assert.equal(camera.pose.look.pitch, 0);
  /* The loop wraps back to the shot: it arrives on its own look and stays there. */
  const yaws = [];
  for (let i = 0; i < 60 * 30 && yaws.length < 60 * 6; i++) {
    camera.step(1 / 60);
    if (camera.index === 0 && !camera.flying) yaws.push(camera.pose.look.yaw);
  }
  assert.ok(yaws.length > 0, "the loop came back to the shot");
  assert.ok(
    yaws.every((yaw) => Math.abs(yaw + 0.3) < 1e-9),
    "a wrap never plays the unveil",
  );
  /* Without a cut the shot is flown to and never looks away either. */
  const flown = createDriftCamera(shots, settings);
  flown.start({ azimuth: 0, inclination: 0, distance: 10 });
  run(2.2, flown);
  assert.equal(flown.pose.look.yaw, -0.3);
});

test("the drift's machine starts once, pauses and resumes, and runs its hooks before writing", () => {
  const log = [];
  const store = createStore((set, get) => ({
    ...driftSlice(set, get, {
      open: (s) => {
        log.push(`open:${s.drift}`);
        return { cleared: true };
      },
      close: (s) => {
        log.push(`close:${s.drift}`);
        return { cleared: false };
      },
    }),
    cleared: false,
  }));
  const api = () => store.getState();
  api().pauseDrift();
  api().toggleDrift();
  assert.equal(api().drift, "off", "nothing to pause or toggle while off");
  api().startDrift();
  assert.equal(api().drift, "loading", "a drift gathers its music and map first");
  assert.equal(api().cleared, true);
  api().startDrift();
  assert.deepEqual(log, ["open:off"], "a second start changes nothing");
  api().toggleDrift();
  api().pauseDrift();
  assert.equal(api().drift, "loading", "nothing to pause or toggle while loading");
  api().readyDrift();
  assert.equal(api().drift, "playing");
  api().readyDrift();
  assert.equal(api().drift, "playing", "ready again changes nothing");
  api().toggleDrift();
  assert.equal(api().drift, "paused");
  api().toggleDrift();
  assert.equal(api().drift, "playing");
  api().pauseDrift();
  api().resumeDrift();
  api().pauseDrift();
  api().stopDrift();
  assert.equal(api().drift, "off");
  assert.equal(api().cleared, false);
  api().stopDrift();
  assert.deepEqual(log, ["open:off", "close:paused"]);
});

test("each simulation's drift clears what stands in its way and leaves the rest alone", () => {
  /* Deep Field: the journey ends, the panel and the card close. */
  useDeepField.getState().startGuide();
  useDeepField.setState({ panel: "view" });
  useDeepField.getState().startDrift();
  const df = useDeepField.getState();
  assert.equal(df.drift, "loading");
  assert.equal(df.guideOpen, false);
  assert.equal(df.panel, "none");
  assert.equal(df.selection, null);
  df.stopDrift();
  assert.equal(useDeepField.getState().drift, "off");

  /* The Orrery: the tour ends, a close-up is left, and the clock keeps its playback. */
  useOrrery.getState().startGuide();
  useOrrery.setState({ closeUp: { kind: "sun" }, panel: "objects", playing: true });
  useOrrery.getState().startDrift();
  const or = useOrrery.getState();
  assert.equal(or.drift, "loading");
  assert.equal(or.guideOpen, false);
  assert.equal(or.closeUp, null);
  assert.equal(or.panel, "none");
  assert.equal(or.playing, false, "the tour's end stopped the playback it owned");
  or.stopDrift();

  /* The observatory: panels, pins and the guide go, gravity comes back on, the preset stays. */
  const hole = useBlackHole.getState();
  hole.startGuide();
  useBlackHole.setState({ settingsOpen: true, gravity: false });
  const presetId = useBlackHole.getState().presetId;
  useBlackHole.getState().startDrift();
  const bh = useBlackHole.getState();
  assert.equal(bh.drift, "loading");
  assert.equal(bh.guideOpen, false);
  assert.equal(bh.settingsOpen, false);
  assert.equal(bh.gravity, true);
  assert.equal(bh.presetId, presetId);
  bh.readyDrift();
  bh.pauseDrift();
  assert.equal(useBlackHole.getState().drift, "paused");
  bh.stopDrift();
  assert.equal(useBlackHole.getState().drift, "off");

  /* Giants: the guide, the panel and the card go; the effects show off, then come back as they were. */
  useGiants.getState().startGuide();
  useGiants.setState({ panel: "view", focusBlur: false, bloom: false });
  useGiants.getState().startDrift();
  const gi = useGiants.getState();
  assert.equal(gi.drift, "loading");
  assert.equal(gi.guideOpen, false);
  assert.equal(gi.panel, "none");
  assert.equal(gi.card, false);
  assert.equal(gi.focusBlur, true);
  assert.equal(gi.bloom, true);
  gi.stopDrift();
  assert.equal(useGiants.getState().focusBlur, false);
  assert.equal(useGiants.getState().bloom, false);
});

test("the Orrery's drift clock reads in both languages at every rate the engine can hand it", async () => {
  const { createFormatter, createTranslator } = await import("next-intl");
  const { featureMessages } = await import("./messages-helper.mjs");
  const { motionRateLabel } = await import("../src/features/orrery/components/time-dock.tsx");
  for (const locale of ["en", "cs"]) {
    const t = createTranslator({
      locale,
      messages: { orrery: featureMessages("orrery", locale) },
      namespace: "orrery",
      onError(error) {
        throw error;
      },
    });
    const f = createFormatter({ locale });
    const motion = t("toggles.drift");
    assert.ok(motion.length, `${locale}: the clock's label`);
    for (const rate of [0, ORRERY.clock, 0.35, 2.5, 12, 30_000]) {
      const text = motionRateLabel(t, f, rate);
      assert.ok(text.length, `${locale}: rate ${rate}`);
      if (rate > 0) assert.ok(/\d/.test(text), `${locale}: ${text} carries a number`);
    }
  }
});

test("a loading drift begins once its map has settled and its music is audible, within its limits", () => {
  const limits = { minimum: 1, timeout: 10 };
  const ready = (status) => driftReady(status, limits);
  assert.equal(
    ready({ map: "settled", music: "audible", elapsed: 0.5 }),
    false,
    "never before the minimum",
  );
  assert.equal(ready({ map: "settled", music: "audible", elapsed: 1 }), true);
  assert.equal(
    ready({ map: "settled", music: "off", elapsed: 1 }),
    true,
    "music off is not waited for",
  );
  assert.equal(ready({ map: "loading", music: "audible", elapsed: 3 }), false);
  assert.equal(ready({ map: "settled", music: "buffering", elapsed: 3 }), false);
  assert.equal(
    ready({ map: "loading", music: "buffering", elapsed: 10 }),
    true,
    "the timeout ends the wait",
  );
  assert.ok(DRIFT_LOADING.minimum > 0 && DRIFT_LOADING.timeout > DRIFT_LOADING.minimum);
});
