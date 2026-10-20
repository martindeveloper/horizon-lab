import assert from "node:assert/strict";
import test from "node:test";

import { createStore } from "zustand/vanilla";

import { DRIFT_DEFAULTS } from "@horizon/toolkit/camera";

import { MUSIC_LEVEL, ambientMusic } from "../src/components/shell/ambient-music.ts";
import { DRIFT as BLACK_HOLE } from "../src/features/black-hole/lib/drift.ts";
import { MAX_DIST, MIN_DIST } from "../src/features/black-hole/lib/physics.ts";
import { useBlackHole } from "../src/features/black-hole/lib/store.ts";
import { DRIFT as DEEP_FIELD } from "../src/features/deep-field/lib/drift.ts";
import { VIEW_IDS } from "../src/features/deep-field/lib/model/view-ids.ts";
import { useDeepField } from "../src/features/deep-field/lib/store.ts";
import { DRIFT as ORRERY } from "../src/features/orrery/lib/drift.ts";
import { canCloseUp, useOrrery } from "../src/features/orrery/lib/store.ts";
import { driftSlice } from "../src/lib/drift.ts";
import { isSolarView } from "../src/space/solar-system/model/views.ts";

const PROGRAMMES = { "deep-field": DEEP_FIELD, orrery: ORRERY, "black-hole": BLACK_HOLE };

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
  for (const shot of DEEP_FIELD.shots)
    assert.ok(VIEW_IDS.includes(shot.view), `deep field view ${shot.view}`);
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
  for (const shot of BLACK_HOLE.shots) {
    assert.ok(
      shot.distance >= MIN_DIST && shot.distance <= MAX_DIST,
      `hole distance ${shot.distance}`,
    );
    const creep = shot.creep ?? BLACK_HOLE.camera.creep ?? DRIFT_DEFAULTS.creep;
    assert.ok(
      shot.distance * (1 - creep) >= MIN_DIST,
      "the hold's push keeps above the camera's floor",
    );
  }
  assert.ok(MUSIC_LEVEL.drift > MUSIC_LEVEL.ambient, "a drift lifts the music");
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
  assert.equal(api().drift, "playing");
  assert.equal(api().cleared, true);
  api().startDrift();
  assert.deepEqual(log, ["open:off"], "a second start changes nothing");
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
  assert.equal(df.drift, "playing");
  assert.equal(df.guideOpen, false);
  assert.equal(df.panel, "none");
  assert.equal(df.selection, null);
  df.stopDrift();
  assert.equal(useDeepField.getState().drift, "off");

  /* The Orrery: the tour ends, a close-up is left, and the clock keeps its playback. */
  useOrrery.getState().startGuide();
  useOrrery.setState({ closeUp: true, panel: "objects", playing: true });
  useOrrery.getState().startDrift();
  const or = useOrrery.getState();
  assert.equal(or.drift, "playing");
  assert.equal(or.guideOpen, false);
  assert.equal(or.closeUp, false);
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
  assert.equal(bh.drift, "playing");
  assert.equal(bh.guideOpen, false);
  assert.equal(bh.settingsOpen, false);
  assert.equal(bh.gravity, true);
  assert.equal(bh.presetId, presetId);
  bh.pauseDrift();
  assert.equal(useBlackHole.getState().drift, "paused");
  bh.stopDrift();
  assert.equal(useBlackHole.getState().drift, "off");
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
