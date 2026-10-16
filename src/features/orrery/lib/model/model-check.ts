/** Consistency checks across the timeline, the orbits, the planetesimal sample and the Galaxy. */
import { planetElements } from "./elements";
import { sunGalactic } from "./galactic-orbit";
import {
  CLEAR_DONE,
  GAS_DISK_LIFETIME,
  MODEL_START,
  SUN_BIRTH,
  SUN_GALACTIC_RADIUS_LY,
  SUN_HEIGHT_LY,
} from "./parameters";
import { migrationProgress, planetGrowth, sliderToYearsAgo, yearsAgoToSlider } from "./timeline";
import { TRACERS, tallyAt } from "./tracers";

export function modelSelfCheck(): string[] {
  const errors: string[] = [];
  for (const u of [0, 0.1, 0.16, 0.22, 0.4, 0.62, 0.8, 1]) {
    const back = yearsAgoToSlider(sliderToYearsAgo(u));
    if (Math.abs(back - u) > 1e-6) errors.push(`slider round trip ${u} -> ${back}`);
  }
  if (migrationProgress(MODEL_START) !== 0 || migrationProgress(CLEAR_DONE) !== 1)
    errors.push("migration window");
  if (
    Math.abs(sliderToYearsAgo(0.25) - MODEL_START) > 1 ||
    Math.abs(sliderToYearsAgo(0.19) - (SUN_BIRTH - GAS_DISK_LIFETIME)) > 1 ||
    Math.abs(sliderToYearsAgo(0.1) - SUN_BIRTH) > 1
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
  const sun = sunGalactic(0, true);
  if (!sun || Math.hypot(sun[0] - SUN_GALACTIC_RADIUS_LY, sun[1] - SUN_HEIGHT_LY, sun[2]) > 1)
    errors.push("sun today shifted");
  return errors;
}
