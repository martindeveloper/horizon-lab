import assert from "node:assert/strict";
import test from "node:test";

import { noteOf } from "../src/features/orrery/lib/model/timeline.ts";
import { TOUR } from "../src/features/orrery/lib/model/tour.ts";
import { FORMATION_BEGINS } from "../src/space/solar-system/model/formation.ts";
import { MODEL_START, SUN_BIRTH } from "../src/space/solar-system/model/parameters.ts";

const step = (id) => {
  const found = TOUR.find((s) => s.id === id);
  assert.ok(found, `the tour has ${id}`);
  return found;
};

test("the Guide tells the birth in order, from the quiet core to the clearing", () => {
  const ids = TOUR.map((s) => s.id);
  const birth = ["birth", "disk", "snowLine", "assembly", "clearing"];
  const at = birth.map((id) => ids.indexOf(id));
  for (let k = 1; k < at.length; k += 1)
    assert.ok(at[k] > at[k - 1], `${birth[k]} follows ${birth[k - 1]}`);
  for (let k = 1; k < birth.length; k += 1)
    assert.ok(
      step(birth[k]).yearsAgo < step(birth[k - 1]).yearsAgo,
      `${birth[k]} is later in time than ${birth[k - 1]}`,
    );
});

test("the birth step plays the formation and stops at the first solids", () => {
  const birth = step("birth");
  assert.equal(birth.yearsAgo, FORMATION_BEGINS);
  assert.ok(birth.playing);
  assert.equal(birth.playUntil, SUN_BIRTH);
  const others = TOUR.filter((s) => s.playing && s.id !== "birth");
  for (const s of others) assert.equal(s.playUntil, undefined, `${s.id} runs on`);
});

test("the assembly step lands in the rocky planets' window, with the gas gone and the sketch not yet begun", () => {
  const assembly = step("assembly");
  assert.ok(assembly.yearsAgo > MODEL_START, "before the clearing sketch starts");
  assert.equal(noteOf(assembly.yearsAgo), "belt");
});

test("Replay's chapters tile the history, each ending where the next begins, and the playhead picks its own", async () => {
  const { CHAPTERS, chapterOf } = await import("../src/features/orrery/lib/model/timeline.ts");
  const { CLEAR_DONE } = await import("../src/space/solar-system/model/parameters.ts");
  assert.equal(CHAPTERS.formation.from, FORMATION_BEGINS);
  assert.equal(CHAPTERS.formation.until, CHAPTERS.disk.from);
  assert.equal(CHAPTERS.disk.until, CHAPTERS.clearing.from);
  assert.equal(CHAPTERS.clearing.until, CHAPTERS.ages.from);
  assert.equal(CHAPTERS.ages.until, null, "the ages run on to today");
  assert.equal(CHAPTERS.history.from, FORMATION_BEGINS);
  assert.equal(CHAPTERS.history.until, null);
  assert.equal(
    chapterOf(FORMATION_BEGINS + 1e9),
    "history",
    "before the formation, the whole history",
  );
  assert.equal(chapterOf(FORMATION_BEGINS), "formation");
  assert.equal(chapterOf(SUN_BIRTH + 1), "formation");
  assert.equal(chapterOf(SUN_BIRTH), "disk");
  assert.equal(chapterOf(MODEL_START + 1), "disk");
  assert.equal(chapterOf(MODEL_START), "clearing");
  assert.equal(chapterOf(CLEAR_DONE), "clearing");
  assert.equal(chapterOf(CLEAR_DONE - 1), "ages");
  assert.equal(chapterOf(6.6e7), "ages");
  assert.equal(chapterOf(0), "history", "at today, the whole history");
});

test("the track breaks exactly where the slider's epochs hand over, oldest first, one epoch per stretch", async () => {
  const { EPOCHS, EPOCH_BOUNDS, epochOf } =
    await import("../src/features/orrery/lib/model/timeline.ts");
  assert.equal(EPOCH_BOUNDS.length, EPOCHS.length - 1);
  let last = Infinity;
  for (const bound of EPOCH_BOUNDS) {
    assert.ok(bound < last, `oldest first at ${bound}`);
    assert.notEqual(epochOf(bound + 1), epochOf(bound - 1), `an epoch changes at ${bound}`);
    last = bound;
  }
  /* Each station lies in the epoch it stands for. */
  for (const epoch of EPOCHS) assert.equal(epochOf(epoch.yearsAgo), epoch.id);
});
