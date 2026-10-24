/** Consistency checks across the timeline, the orbits and the planetesimal sample. */
import { planetElements } from "@/space/solar-system/model/elements";
import { migrationProgress, planetGrowth } from "@/space/solar-system/model/moment";
import {
  CLEAR_DONE,
  GAS_DISK_LIFETIME,
  MODEL_START,
  SUN_BIRTH,
} from "@/space/solar-system/model/parameters";
import { TRACERS, tallyAt } from "@/space/solar-system/model/tracers";

import { EPOCH_BOUNDS, EPOCHS, TRACK_CELLS, sliderToYearsAgo, yearsAgoToSlider } from "./timeline";

export function modelSelfCheck(): string[] {
  const errors: string[] = [];
  for (const u of [0, 0.1, 0.16, 0.22, 0.4, 0.62, 0.8, 1]) {
    const back = yearsAgoToSlider(sliderToYearsAgo(u));
    if (Math.abs(back - u) > 1e-6) errors.push(`slider round trip ${u} -> ${back}`);
  }
  if (migrationProgress(MODEL_START) !== 0 || migrationProgress(CLEAR_DONE) !== 1)
    errors.push("migration window");
  /* Each epoch ends at a cell's edge of the track (the names' cells beneath it), and the
     joins inside the birth's cell land on their moments. */
  let cells = 0;
  const edges = EPOCHS.map((epoch) => (cells += epoch.cells) / TRACK_CELLS);
  if (
    EPOCH_BOUNDS.some((bound, k) => Math.abs(yearsAgoToSlider(bound) - (edges[k] ?? 0)) > 1e-9) ||
    [SUN_BIRTH, SUN_BIRTH - GAS_DISK_LIFETIME].some(
      (y) => Math.abs(sliderToYearsAgo(yearsAgoToSlider(y)) - y) > 1,
    )
  )
    errors.push("slider segments");
  if (
    planetGrowth("jupiter", SUN_BIRTH - 3e6) !== 1 ||
    planetGrowth("earth", SUN_BIRTH - 1e6) >= 0.1
  )
    errors.push("growth curves");
  const early = tallyAt(MODEL_START);
  const now = tallyAt(0);
  if (early.ejected !== 0 || early.oort !== 0 || now.disk !== 0) errors.push("tally ends");
  if (now.ejected < TRACERS.length * 0.45) errors.push("ejected should be the largest share");
  const date = new Date();
  const n0 = planetElements("neptune", 0, 0, date).a;
  const n1 = planetElements("neptune", 1, 0, date).a;
  if (!(n0 < 15 && n1 > 29.9)) errors.push(`neptune ${n0} -> ${n1}`);
  return errors;
}
